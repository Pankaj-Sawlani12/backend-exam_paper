require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');

const AuthRouter = require('./Routes/AuthRouter');
const ProductRouter = require('./Routes/ProductRouter');
const StudentRouter = require('./Routes/StudentRouter');
const TeacherRouter = require('./Routes/TeacherRouter');
const CourseRouter = require('./Routes/CourseRouter');
const ClassroomRouter = require('./Routes/ClassroomRouter');
const ExamCycleRouter = require('./Routes/ExamCycleRouter');
const ExamSessionRouter = require('./Routes/ExamSessionRouter');
const ExamScheduleRouter = require('./Routes/ExamScheduleRouter');
const TimetableRouter = require('./Routes/TimetableRouter');
const CourseEnrollmentRouter = require('./Routes/CourseEnrollmentRouter');
const ConflictRouter = require('./Routes/ConflictRouter');
const SeatingArrangementRouter = require('./Routes/SeatingArrangementRouter');
const InvigilationDutyRouter = require('./Routes/InvigilationDutyRouter');

const connectDB = require('./Models/db');

const PORT = process.env.PORT || 8080;

app.get('/ping',(req,res)=>{
    res.send('PONG');
});

app.use(bodyParser.json()); 
app.use(cors())
app.use('/auth', AuthRouter);
app.use('/products',ProductRouter);
app.use('/students', StudentRouter);
app.use('/teachers', TeacherRouter);
app.use('/courses', CourseRouter);
app.use('/classrooms', ClassroomRouter);
app.use('/exam-cycles', ExamCycleRouter);
app.use('/exam-sessions', ExamSessionRouter);
app.use('/exam-schedules', ExamScheduleRouter);
app.use('/timetable', TimetableRouter);
app.use('/course-enrollments', CourseEnrollmentRouter);
app.use('/conflicts', ConflictRouter);
app.use('/seating-arrangements', SeatingArrangementRouter);
app.use('/invigilation-duties', InvigilationDutyRouter);

app.listen(PORT, () => {
    console.log(`Server is Running on ${PORT}`);
});

module.exports = app;