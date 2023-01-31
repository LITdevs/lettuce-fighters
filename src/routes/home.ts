import express, {Request, Response, Router} from 'express';
import AuthHelper from "../util/AuthHelper";

const router: Router = express.Router();

router.get("/", (req, res) => {
	res.render("index", {title: "Lettuce Fighters"})
})

router.get("/game", AuthHelper, (req, res) => {
	res.render("game", {title: "Lettuce Fighters"})
})

export default router;