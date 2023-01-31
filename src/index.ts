require("dotenv").config();

const express = require("express");
const app = express();
const server = require('http').Server(app);
const port = process.env.PORT || 3773;
import {getPawn} from "./databaseManager";

import { Server } from "socket.io";
const cookieParser = require("cookie-parser");

const DiscordStrategy = require('passport-discord').Strategy;
const scopes = ['identify'];

const passport = require("passport");
const session = require("express-session");

const MongoDBStore = require("connect-mongodb-session")(session);
const store = new MongoDBStore({
	uri: process.env.MONGODB_URI,
	collection: 'sessions',
	clear_interval: 3600
});

passport.serializeUser(function(user, done) {
	done(null, user);
});
passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

const participants = [
	"659398876960129025", // !?
	"222694725487034369", // 3oF
	"266098747849572352", // AnnoyingRains
	"261228937206562817", // Catto
	"490664749315653642", // Mitch
	"295975431058751498", // laker
	"659253543349387304", // MCV
	"629028955646853141", // Mot
	"539306837175042058", // Neatnik
	"515645198626193418", // Nisha
	"907324666710986764", // lolboi20
	"485376328980365312", // NullCube
	"453924399402319882", // Sharky
	"264139669174878219", // Bye
	"850273334486368276", // Thonk
	"125644326037487616", // Trash
	"708333380525228082"  // Vukky
]

const gridWidth = 35;
const gridHeight = 25;
export {gridWidth, gridHeight};

passport.use(new DiscordStrategy({
		clientID: '876183728970412072',
		clientSecret: process.env.DISCORD_CLIENT_SECRET,
		callbackURL: process.env.OAUTH_CALLBACK,
		scope: scopes
	},
	async function(accessToken, refreshToken, profile, cb) {
		if (participants.includes(profile.id)) {
			try {
				let Pawn = getPawn();
				let pawn = await Pawn.findOne({discordId: profile.id})
				if (!pawn) return cb(null, false);
				pawn.username = profile.username;
				await pawn.save();
				return cb(null, pawn);
			} catch (e) {
				console.error(e);
				return cb(e, false);
			}
		} else {
			return cb(null, false);
		}
}));

let sessionMiddleware = session({
	secret: process.env.SESSION_SECRET,
	resave: true,
	saveUninitialized: false,
	store: store
})

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.use(cookieParser());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

app.locals.gridWidth = gridWidth;
app.locals.gridHeight = gridHeight;

const io = new Server(server);
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

const getIo = () => {
	return io;
}

export { getIo };

import home from "./routes/home";
import api from "./routes/api";
app.use("/", home);
app.use("/api", api);

app.get("/auth/login", passport.authenticate("discord", {scope: scopes}))

app.get("/auth/callback", passport.authenticate("discord", {failureRedirect: "/?loginFailure=true"}), (req, res) => {
	res.redirect("/game");
})

app.get("/auth/logout", (req, res) => {
	req.logout(() => {
		req.session.destroy(() => {
			res.redirect("/");
		});
	});
})


app.post("/test", (req, res) => {
	if (!req.headers.admin || req.headers.admin !== process.env.ADMIN_SECRET) return res.status(401).end();
	io.emit("update", req.body)
	res.status(200).end();
})


app.get("*", (req, res) => {
	res.status(418).end();
})

setInterval(async () => {
	//console.log("Checking for dead pawns...")
	let Pawn = getPawn();
	let pawns = await Pawn.find({alive: false});
	for (let pawn of pawns) {
		if (pawn.position && pawn.position.x === 0 && pawn.position.y === 256) return;
		let timeSinceDeath = new Date().getTime() - pawn.diedAt.getTime();
		//console.log("tsd: ", timeSinceDeath);
		if (timeSinceDeath < 259200000) return;
		console.log("dead user: ", pawn.username)
		console.log("tsd enough:", timeSinceDeath);
		pawn.position = {
			x: 0,
			y: 256
		};
		pawn.markModified("position");
		await pawn.save();
		console.log("Saving...")
		io.emit("move", pawn);
	}
}, 10000)

server.listen(port, () => {
	console.log(`Listening on port ${port}`);
})