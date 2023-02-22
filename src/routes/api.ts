import express, {Request, Response, Router} from 'express';
import AuthHelper from "../util/AuthHelper"
import {getPawn, getEvent} from "../databaseManager";
import axios from "axios";

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

router.post("/event", async (req: Request, res: Response) => {
    if (req.headers?.refill !== process.env.REFILL_KEY) return res.status(401).send("Invalid key");
    let Event = getEvent()
    let event = new Event({
        eventText: req.body.eventText,
        timestamp: new Date()
    })
    await event.save()
    io.emit("event", { timestamp: new Date(), eventText: req.body.eventText })
    await axios.post(process.env.DISCORD_WEBHOOK, { content: req.body.eventText })
    res.json({success: true})
})

router.post("/rce", async (req: Request, res: Response) => {
    if (req.headers?.refill !== process.env.REFILL_KEY) return res.status(401).send("Invalid key");
    io.emit(req.body.eventType, req.body.eventData);
    res.json({success: true})
})

router.post("/forceMove", async (req: Request, res: Response) => {
    if (req.headers?.refill !== process.env.REFILL_KEY) return res.status(401).send("Invalid key");
    io.emit(req.body.eventType, req.body.eventData);

    let Pawn = getPawn();
    let pawn = await Pawn.findOne({discordId: req.body.user})
    pawn.position.x = req.body.x;
    pawn.position.y = req.body.y;

    pawn.save();

    let Event = getEvent();

    let event = new Event({
        timestamp: new Date(),
        eventText: `${pawn.username} moved to ${req.body.x}, ${req.body.y}`
    })

    event.save();

    io.emit("event", { timestamp: event.timestamp, eventText: event.eventText })
    io.emit("move", pawn)
    res.json({success: true})
})

router.post("/forceupdate", async (req: Request, res: Response) => {
    if (req.headers?.refill !== process.env.REFILL_KEY) return res.status(401).send("Invalid key");
    let Pawn = getPawn();
    let pawns = await Pawn.find();
    io.emit("refill", pawns);
    res.json({success: true})
})

router.get("/analytics", async (req, res) => {
    let Event = getEvent();
    let events = await Event.find({})

    let killers = {}
    let movers = {}
    let attackers = {}
    let givers = {}

    events.forEach(event => {
        let et = event.eventText
        if (et.includes("not")) return
        if (et.includes("really")) return
        if (et.includes("bug")) return
        if (et.includes("Supreme")) return
        if (new Date(event.timestamp) > new Date("2023-02-22T01:03:06.730+00:00")) return;
        if (et.includes("killed")) {
            let killer = et.split(" killed")[0]
            if (!killers[killer]) killers[killer] = 0;
            killers[killer] += 1;
            if (!attackers[killer]) attackers[killer] = 0;
            attackers[killer] += 1;
        }
        if (et.includes("attacked")) {
            let attacker = et.split(" attacked")[0]
            if (!attackers[attacker]) attackers[attacker] = 0;
            attackers[attacker] += 1;
        }
        if (et.includes("moved")) {
            let mover = et.split(" moved")[0]
            if (!movers[mover]) movers[mover] = 0;
            movers[mover] += 1;
        }
        if (et.includes("gave")) {
            let giver = et.split(" gave")[0]
            if (!givers[giver]) givers[giver] = 0;
            givers[giver] += 1;
        }
    })
    res.json({killers, movers, attackers, givers})
})

router.post("/refill", async (req: Request, res: Response) => {
    if (req.headers?.refill !== process.env.REFILL_KEY) return res.status(401).send("Invalid key");
    let Pawn = getPawn();
    let Event = getEvent()
    let pawns = await Pawn.find();
    for (let pawn of pawns) {
        if (pawn.alive) {
            pawn.actions += 1;
            await pawn.save()
        }
    }

    let supremeCourtPawns = pawns.filter(pawn => !pawn.alive && pawn.vote);
    // Count the number of votes for each pawn
    let voteCount = {};
    for (let pawn of supremeCourtPawns) {
        let vote
        if (pawn.vote === "1029431168094978150") vote = "453924399402319882"
        else vote = pawn.vote;
        if (voteCount[vote]) {
            voteCount[vote] += 1;
        } else {
            voteCount[vote] = 1;
        }
    }

    // Find all pawns with 3 or more votes
    for (const votee of Object.keys(voteCount)) {
        if (voteCount[votee] < 3) continue;
        let voteePawn = await Pawn.findOne({discordId: votee})
        voteePawn.actions += Math.floor(voteCount[votee] / 3);
        let event = new Event({
            timestamp: new Date(),
            eventText: `${voteePawn.username} was given ${Math.floor(voteCount[votee] / 3)} extra lettuce by the Supreme Court of Lettuce.`
        });
        await event.save()
        io.emit("event", { timestamp: event.timestamp, eventText: event.eventText })
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
    let event = new Event({
        timestamp: new Date(),
        eventText: "Lettuce drop"
    });
    io.emit("event", { timestamp: event.timestamp, eventText: event.eventText })
    await axios.post(process.env.DISCORD_WEBHOOK, { content: event.eventText })
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
        if (!pawn.alive) return;
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
        await axios.post(process.env.DISCORD_WEBHOOK, { content: event.eventText })

        io.emit("move", pawn)
    })

    socket.on("attack", async (attackedPawnId) => {
        // @ts-ignore
        if (!socket.request.isAuthenticated()) return;

        let Pawn = getPawn();
        // @ts-ignore
        let pawn = await Pawn.findOne({discordId: socket.request.user.discordId})
        if (!pawn) return;
        if (!pawn.alive) return;

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
        await axios.post(process.env.DISCORD_WEBHOOK, { content: event.eventText })

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
        if (!pawn.alive) return;

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
        await axios.post(process.env.DISCORD_WEBHOOK, { content: event.eventText })
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