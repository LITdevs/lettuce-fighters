import express, {Request, Response, Router} from 'express';
import AuthHelper from "../util/AuthHelper"

const router: Router = express.Router();

router.get('/', AuthHelper, (req: Request, res: Response) => {
    res.send('Hello World!');
});

export default router;