const express = require('express');

const router = express.Router();

const {
    addCourseEnrollment,
    getCourseEnrollments
} = require('../Controllers/CourseEnrollmentController');

router.post('/add', addCourseEnrollment);

router.get('/', getCourseEnrollments);

module.exports = router;