const express = require('express');

const router = express.Router();

const {
    getCourseConflicts
} = require('../Controllers/ConflictController');

router.get('/', getCourseConflicts);

module.exports = router;