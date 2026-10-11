const router = require('express').Router();

const {
    addStudent,
    getStudents
} = require('../Controllers/StudentController');

const {
    getMyOverview,
    getMyExamSchedule,
    getMySittingPlan,
    getMyExamShifts
} = require('../Controllers/StudentPortalController');

const {
    ensureAuthenticated,
    authorizeRoles
} = require('../Middlewares/Auth');

router.post('/add', addStudent);

router.get('/', getStudents);

// Student portal: every route below only ever returns the data of the
// logged-in student (identified from the JWT), never anyone else's.
router.get(
    '/me/overview',
    ensureAuthenticated,
    authorizeRoles('student'),
    getMyOverview
);

router.get(
    '/me/exam-schedule',
    ensureAuthenticated,
    authorizeRoles('student'),
    getMyExamSchedule
);

router.get(
    '/me/sitting-plan',
    ensureAuthenticated,
    authorizeRoles('student'),
    getMySittingPlan
);

router.get(
    '/me/exam-shifts',
    ensureAuthenticated,
    authorizeRoles('student'),
    getMyExamShifts
);

module.exports = router;
