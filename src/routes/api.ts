import express, {Request, Response, Router} from 'express';
import AuthHelper from "../util/AuthHelper"
import {getPawn, getEvent} from "../databaseManager";

const router: Router = express.Router();

router.get('/', AuthHelper, (req: Request, res: Response) => {
    res.send('Hello World!');
});

router.get("/pawns", async (req: Request, res: Response) => {
   let Pawn = getPawn();
   let pawns = await Pawn.find();
   let pawnList = pawns.map(pawn => {
         return {
             position: pawn.position,
             tint: pawn.tint,
             username: pawn.username,
             health: pawn.health,
             alive: pawn.alive,
             actions: pawn.actions,
             discordId: pawn.discordId,
             diedAt: pawn.diedAt,
             killedBy: pawn.killedBy
         }
   })
    res.json(pawnList)
})

router.post("/refill", async (req: Request, res: Response) => {
    if (req.headers?.refill !== process.env.REFILL_KEY) return res.status(401).send("Invalid key");
    let Pawn = getPawn();
    let pawns = await Pawn.find();
    for (let pawn of pawns) {
        if (pawn.alive) {
            pawn.actions += 1;
            await pawn.save()
        }
    }

    let supremeCourtPawns = pawns.filter(pawn => !pawn.alive);
    // Count the number of votes for each pawn
    let voteCount = {};
    for (let pawn of supremeCourtPawns) {
        if (voteCount[pawn.vote]) {
            voteCount[pawn.vote] += 1;
        } else {
            voteCount[pawn.vote] = 1;
        }
    }

    // Find all pawns with 3 or more votes
    for (const votee of Object.keys(voteCount)) {
        if (voteCount[votee] < 3) continue;
        let voteePawn = await Pawn.findOne({discordId: votee})
        voteePawn.actions += 1;
        await voteePawn.save();
    }

    pawns = await Pawn.find({});

    let pawnList = pawns.map(pawn => {
        return {
            position: pawn.position,
            tint: pawn.tint,
            username: pawn.username,
            health: pawn.health,
            alive: pawn.alive,
            actions: pawn.actions,
            discordId: pawn.discordId,
            diedAt: pawn.diedAt,
            killedBy: pawn.killedBy
        }
    })

    io.emit("refill", pawnList);
    res.json({pawnList, voteCount})
})

router.get("/events", async (req: Request, res: Response) => {
    let Event = getEvent();
    let events = await Event.find({}).sort({timestamp: -1}).limit(10);
    res.json(events);
})

import { getIo, gridWidth, gridHeight } from "../index";

let io = getIo();

let connectedClients = {};

io.on("connection", (socket) => {
    // @ts-ignore
    if (socket.request.isAuthenticated()) {
        // @ts-ignore
        if (!connectedClients[socket.request.user.discordId]) connectedClients[socket.request.user.discordId] = 0;
        // @ts-ignore
        connectedClients[socket.request.user.discordId] += 1;
    }
    socket.on("disconnect", function(){
        // @ts-ignore
        if (socket.request.isAuthenticated()) {
            // @ts-ignore
            connectedClients[socket.request.user.discordId] -= 1;
        }
    });
    socket.on("move", async (data) => {
        // @ts-ignore
        if (!socket.request.isAuthenticated()) return;

        let Pawn = getPawn();
        // @ts-ignore
        let pawn = await Pawn.findOne({discordId: socket.request.user.discordId})
        if (!pawn) return;
        if (pawn.actions <= 0) return;

        // Check that the new position is within 1 tile of the current position
        let xDiff = Math.abs(pawn.position.x - data.position.x);
        let yDiff = Math.abs(pawn.position.y - data.position.y);
        console.log(xDiff, yDiff)
        if (xDiff > 1 || yDiff > 1) return;

        // Check that the new position is not occupied
        let occupant = await Pawn.findOne({position: data.position});
        if (occupant && occupant.alive) return;
        // If the occupant is dead, check if 3 days have passed since they died
        if (occupant && !occupant.alive) {
            let timeSinceDeath = new Date().getTime() - occupant.diedAt.getTime();
            if (timeSinceDeath < 259200000) return;
        }

        // Check that the new position is not outside the map
        if (data.position.x < 0 || data.position.x >= gridWidth || data.position.y < 0 || data.position.y >= gridHeight) return;

        // Update the position and broadcast the new position
        pawn.position = data.position;
        pawn.actions -= 1;
        await pawn.save();

        let Event = getEvent();
        let event = new Event({
            timestamp: new Date(),
            eventText: `${pawn.username} moved to ${pawn.position.x}, ${pawn.position.y}`
        })

        await event.save();

        io.emit("event", { timestamp: event.timestamp, eventText: event.eventText })

        io.emit("move", pawn)
    })

    socket.on("attack", async (attackedPawnId) => {
        // @ts-ignore
        if (!socket.request.isAuthenticated()) return;

        let Pawn = getPawn();
        // @ts-ignore
        let pawn = await Pawn.findOne({discordId: socket.request.user.discordId})
        if (!pawn) return;

        if (attackedPawnId === pawn.discordId) return;
        if (pawn.actions <= 0) return;

        let attackedPawn = await Pawn.findOne({discordId: attackedPawnId});
        if (!attackedPawn) return;
        if (!attackedPawn.alive) return;

        // Check that the attacked pawn is within 4.25 tiles of the current position
        // Diagonal tiles count as more tiles
        let xDiff = Math.abs(pawn.position.x - attackedPawn.position.x);
        let yDiff = Math.abs(pawn.position.y - attackedPawn.position.y);
        let distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
        if (distance > 4.25) return;
        console.log(distance)

        attackedPawn.health -= 1;
        if (attackedPawn.health <= 0) {
            attackedPawn.alive = false;
            attackedPawn.diedAt = new Date();
            attackedPawn.killedBy = pawn.discordId;
        }

        pawn.actions -= 1;

        await pawn.save();
        await attackedPawn.save()

        let Event = getEvent();
        let event = new Event({
            timestamp: new Date(),
            eventText: `${pawn.username} ${attackedPawn.alive ? "attacked" : "killed"} ${attackedPawn.username}`
        })

        io.emit("event", { timestamp: event.timestamp, eventText: event.eventText })

        io.emit("attack", {attackedPawn, attacker: pawn})

        await event.save();

    })

    socket.on("give", async (giveToId) => {
        // @ts-ignore
        if (!socket.request.isAuthenticated()) return;

        let Pawn = getPawn();
        // @ts-ignore
        let pawn = await Pawn.findOne({discordId: socket.request.user.discordId})
        if (!pawn) return;

        if (giveToId === pawn.discordId) return;
        if (pawn.actions <= 0) return;

        let giveToPawn = await Pawn.findOne({discordId: giveToId});
        if (!giveToPawn) return;
        if (!giveToPawn.alive) return;

        // Check that the attacked pawn is within 7.5 tiles of the current position
        // Diagonal tiles count as more tiles
        let xDiff = Math.abs(pawn.position.x - giveToPawn.position.x);
        let yDiff = Math.abs(pawn.position.y - giveToPawn.position.y);
        let distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
        if (distance > 7.5) return;
        console.log(distance)

        pawn.actions -= 1;
        giveToPawn.actions += 1;

        await pawn.save();
        await giveToPawn.save()

        let Event = getEvent();
        let event = new Event({
            timestamp: new Date(),
            eventText: `${pawn.username} gave lettuce to ${giveToPawn.username}`
        })

        io.emit("event", { timestamp: event.timestamp, eventText: event.eventText })

        io.emit("give", {giveToPawn, giverPawn: pawn})

        await event.save();
    })

    socket.on("supremeCourt", async (voteId) => {
        let Pawn = getPawn();
        // @ts-ignore
        let pawn = await Pawn.findOne({discordId: socket.request.user.discordId})
        if (!pawn) return;

        if (pawn.alive) return;

        pawn.vote = voteId;

        await pawn.save();
    })

    socket.on("connectionCount", async () => {
        let connectedClientsCount = 0
        for (const client of Object.keys(connectedClients)) {
            if (connectedClients[client] >= 1) connectedClientsCount++
        }
        socket.emit("connectionCount", connectedClientsCount)
        // @ts-ignore
        /*if (socket.request.user.discordId === "125644326037487616") {
            socket.emit("custom", connectedClients)
        }*/
    })
})

export default router;