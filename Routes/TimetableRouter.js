const express = require('express');

const router = express.Router();

const {
    generateTimetable,
    getTimetable
} = require('../Controllers/TimetableController');

router.get('/generate', generateTimetable);

router.get('/', getTimetable);

module.exports = router;