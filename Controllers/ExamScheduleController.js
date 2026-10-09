const ExamScheduleModel = require('../Models/ExamSchedule');
const ExamCycleModel = require('../Models/ExamCycle');
const ExamSessionModel = require('../Models/ExamSession');
const CourseModel = require('../Models/Course');
const connectDB = require('../Models/db');


const addExamSchedule = async (req, res) => {
    try {
        await connectDB();

        const {
            examCycle,
            examSession,
            course
        } = req.body;


        // Check Exam Cycle
        const cycle = await ExamCycleModel.findById(examCycle);

        if (!cycle) {
            return res.status(404).json({
                message: 'Exam cycle not found',
                success: false
            });
        }


        // Check Exam Session
        const session = await ExamSessionModel.findById(examSession);

        if (!session) {
            return res.status(404).json({
                message: 'Exam session not found',
                success: false
            });
        }


        // Check Course
        const courseData = await CourseModel.findById(course);

        if (!courseData) {
            return res.status(404).json({
                message: 'Course not found',
                success: false
            });
        }


        // Make sure session belongs to selected cycle
        if (session.examCycle.toString() !== examCycle) {
            return res.status(400).json({
                message: 'Exam session does not belong to selected exam cycle',
                success: false
            });
        }


        // Check whether course is already scheduled
        // in this exam cycle
        const existingSchedule = await ExamScheduleModel.findOne({
            examCycle,
            course
        });

        if (existingSchedule) {
            return res.status(409).json({
                message: 'Course is already scheduled in this exam cycle',
                success: false
            });
        }


        // Create schedule
        const examSchedule = new ExamScheduleModel({
            examCycle,
            examSession,
            course
        });

        await examSchedule.save();


        res.status(201).json({
            message: 'Exam schedule added successfully',
            success: true,
            examSchedule
        });

    } catch (err) {

        console.error('ADD EXAM SCHEDULE ERROR:', err);

        res.status(500).json({
            message: 'Internal Server Error',
            success: false
        });
    }
};



const getExamSchedules = async (req, res) => {

    try {

        await connectDB();

        const examSchedules = await ExamScheduleModel
            .find()
            .populate(
                'examCycle',
                'cycleName academicYear semester examType'
            )
            .populate(
                'examSession',
                'sessionDate startTime endTime sessionType'
            )
            .populate(
                'course',
                'courseCode courseName department semester examDuration'
            )
            .sort({
                createdAt: 1
            });


        res.status(200).json({
            success: true,
            examSchedules
        });

    } catch (err) {

        console.error('GET EXAM SCHEDULES ERROR:', err);

        res.status(500).json({
            message: 'Internal Server Error',
            success: false
        });
    }
};



module.exports = {
    addExamSchedule,
    getExamSchedules
};