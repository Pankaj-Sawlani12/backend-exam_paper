    const express = require('express');

const router = express.Router();

const {
    addExamSchedule,
    getExamSchedules
} = require('../Controllers/ExamScheduleController');


router.post('/add', addExamSchedule);

router.get('/', getExamSchedules);


module.exports = router;