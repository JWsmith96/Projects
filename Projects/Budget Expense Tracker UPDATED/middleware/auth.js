function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

function checkAuthLevel(minLevel) {
    return (req, res, next) => {
        if (req.isAuthenticated() && req.user.authlevel >= minLevel) {
            return next();
        }
        res.status(403).send('Forbidden');
    };
}

module.exports = { isAuthenticated, checkAuthLevel };
