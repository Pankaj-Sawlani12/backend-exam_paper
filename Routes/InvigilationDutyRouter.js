const router = require('express').Router();

const {
    generateInvigilationDuties,
    getInvigilationDuties
} = require('../Controllers/InvigilationDutyController');

const {
    ensureAuthenticated,
    authorizeRoles
} = require('../Middlewares/Auth');

router.get(
    '/',
    ensureAuthenticated,
    authorizeRoles('admin'),
    getInvigilationDuties
);

router.post(
    '/generate',
    ensureAuthenticated,
    authorizeRoles('admin'),
    generateInvigilationDuties
);

router.get(
    '/my-duties',
    ensureAuthenticated,
    authorizeRoles('teacher'),
    getInvigilationDuties
);

module.exports = router;

