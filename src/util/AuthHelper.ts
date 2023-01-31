import {getPawn} from "../databaseManager";

/**
 * Check if request is authenticated
 * Express middleware
 * @param req
 * @param res
 * @param next
 */
export default async function (req, res, next) {
    if (isAuthenticated(req)) {
        let Pawn = getPawn();
        let pawn = await Pawn.findOne({discordId: req.user.discordId})
        res.locals.user = pawn;
        return next();
    }
    if (!req.originalUrl.startsWith("/game")) return res.redirect("/");
    next()
}

/**
 * Check if request is authenticated
 * @param req
 * @returns {boolean}
 */
export function isAuthenticated (req) {
    return req.isAuthenticated();
}