const CourseEnrollmentModel = require('../Models/CourseEnrollment');
const StudentModel = require('../Models/Student');
const CourseModel = require('../Models/Course');
const connectDB = require('../Models/db');

const addCourseEnrollment = async (req, res) => {
    try {
        await connectDB();

        const { student, course } = req.body;

        if (!student || !course) {
            return res.status(400).json({
                message: 'Student and course are required'
            });
        }

        // Check student exists
        const studentExists = await StudentModel.findById(student);

        if (!studentExists) {
            return res.status(404).json({
                message: 'Student not found'
            });
        }

        // Check course exists
        const courseExists = await CourseModel.findById(course);

        if (!courseExists) {
            return res.status(404).json({
                message: 'Course not found'
            });
        }

        // Check duplicate enrollment
        const existingEnrollment =
            await CourseEnrollmentModel.findOne({
                student,
                course
            });

        if (existingEnrollment) {
            return res.status(409).json({
                message: 'Student is already enrolled in this course'
            });
        }

        const enrollment = new CourseEnrollmentModel({
            student,
            course
        });

        await enrollment.save();

        res.status(201).json({
            message: 'Course enrollment added successfully',
            enrollment
        });

    } catch (err) {
        console.error('Add Course Enrollment Error:', err);

        res.status(500).json({
            message: 'Internal server error'
        });
    }
};


const getCourseEnrollments = async (req, res) => {
    try {
        await connectDB();

        const enrollments = await CourseEnrollmentModel.find()
            .populate({
                path: 'student',
                populate: {
                    path: 'user',
                    select: 'name email'
                }
            })
            .populate({
                path: 'course',
                select: 'courseCode courseName department semester examDuration'
            })
            .sort({ createdAt: -1 });

        res.status(200).json(enrollments);

    } catch (err) {
        console.error('Get Course Enrollment Error:', err);

        res.status(500).json({
            message: 'Internal server error'
        });
    }
};


module.exports = {
    addCourseEnrollment,
    getCourseEnrollments
};