
const jwt = require('jsonwebtoken');

const ensureAuthenticated = (req, res, next) => {
    const auth = req.headers['authorization'];

    if (!auth) {
        return res.status(403).json({
            message: 'Unauthorized, JWT token is required'
        });
    }

    try {
        // Support both "Bearer <token>" and a raw token.
        const token = auth.startsWith('Bearer ')
            ? auth.slice(7)
            : auth;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            message: 'Unauthorized, JWT token is wrong or expired'
        });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Forbidden: insufficient permissions'
            });
        }

        next();
    };
};

module.exports = {
    ensureAuthenticated,
    authorizeRoles
};
