
const router = require('express').Router();

const {
    addClassroom,
    getClassrooms
} = require('../Controllers/ClassroomController');

const {
    ensureAuthenticated,
    authorizeRoles
} = require('../Middlewares/Auth');

// Only admins can add classrooms
router.post(
    '/add',
    ensureAuthenticated,
    authorizeRoles('admin'),
    addClassroom
);

// Only admins can view classrooms
router.get(
    '/',
    ensureAuthenticated,
    authorizeRoles('admin'),
    getClassrooms
);

module.exports = router;
