import express, {Request, Response, Router} from 'express';

const router: Router = express.Router();

router.get("/", (req, res) => {
	res.render("index", {title: "Lettuce Fighters"})
})

export default router;