/**
 * Check if request is authenticated
 * Express middleware
 * @param req
 * @param res
 * @param next
 */
export default function (req, res, next) {
    if (isAuthenticated(req)) {
        return next();
    }
    res.redirect("/");
}

/**
 * Check if request is authenticated
 * @param req
 * @returns {boolean}
 */
export function isAuthenticated (req) {
    return req.isAuthenticated();
}