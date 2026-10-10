
const router = require('express').Router();

const {
    generateSeatingArrangement,
    getSeatingArrangement
} = require('../Controllers/SeatingArrangementController');

const {
    ensureAuthenticated,
    authorizeRoles
} = require('../Middlewares/Auth');

// Only admins can generate seating arrangements
router.post(
    '/generate',
    ensureAuthenticated,
    authorizeRoles('admin'),
    generateSeatingArrangement
);

// Only admins can view seating arrangements
router.get(
    '/',
    ensureAuthenticated,
    authorizeRoles('admin'),
    getSeatingArrangement
);

module.exports = router;
