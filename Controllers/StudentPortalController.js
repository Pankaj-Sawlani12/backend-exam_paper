const StudentModel = require('../Models/Student');
const UserModel = require('../Models/User');
const CourseEnrollmentModel = require('../Models/CourseEnrollment');
const TimetableModel = require('../Models/Timetable');
const SeatingArrangementModel = require('../Models/SeatingArrangement');
const connectDB = require('../Models/db');

// Make sure every model used by populate() is registered (important on
// serverless platforms where each route may be loaded in isolation).
require('../Models/ExamCycle');
require('../Models/ExamSession');
require('../Models/Course');
require('../Models/Classroom');

// Students are asked to reach the exam hall this many minutes before the
// exam starts. Change this single value to adjust the reporting time shown
// on the "My Exam Shifts" page.
const REPORTING_BUFFER_MINUTES = 30;

/**
 * Converts "09:30", "9:30 AM" or "02:00 PM" into minutes since midnight.
 * Returns null when the value cannot be understood.
 */
const toMinutes = (time) => {
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(time || '').trim());

    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3] ? match[3].toUpperCase() : null;

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    if (hours > 23 || minutes > 59) return null;

    return hours * 60 + minutes;
};

const getReportingTime = (startTime) => {
    const start = toMinutes(startTime);

    if (start === null) return null;

    const reporting = Math.max(0, start - REPORTING_BUFFER_MINUTES);
    const hh = String(Math.floor(reporting / 60)).padStart(2, '0');
    const mm = String(reporting % 60).padStart(2, '0');

    return `${hh}:${mm}`;
};

const bySessionDateThenTime = (a, b) => {
    const dateA = new Date(a.examSession?.sessionDate || 0).getTime();
    const dateB = new Date(b.examSession?.sessionDate || 0).getTime();

    if (dateA !== dateB) return dateA - dateB;

    return (
        (toMinutes(a.examSession?.startTime) ?? 0) -
        (toMinutes(b.examSession?.startTime) ?? 0)
    );
};

/**
 * Finds the student profile that belongs to the logged-in user.
 * Sends the error response itself and returns null when not found.
 */
const getLoggedInStudent = async (req, res) => {
    const student = await StudentModel.findOne({ user: req.user._id }).lean();

    if (!student) {
        res.status(404).json({
            success: false,
            message:
                'Your student profile has not been created yet. Please contact the examination office.'
        });

        return null;
    }

    return student;
};

/**
 * Builds the student's exam list: the timetable entries of every course the
 * student is enrolled in, together with the student's own seat for it.
 */
const buildStudentExams = async (student, examCycle) => {
    const enrollments = await CourseEnrollmentModel.find({
        student: student._id
    })
        .select('course')
        .lean();

    const courseIds = enrollments.map((enrollment) => enrollment.course);

    if (courseIds.length === 0) return [];

    const timetableFilter = { course: { $in: courseIds } };
    const seatFilter = { student: student._id };

    if (examCycle) {
        timetableFilter.examCycle = examCycle;
        seatFilter.examCycle = examCycle;
    }

    const [timetable, seats] = await Promise.all([
        TimetableModel.find(timetableFilter)
            .populate(
                'examCycle',
                'cycleName academicYear semester examType status'
            )
            .populate(
                'examSession',
                'sessionDate startTime endTime sessionType'
            )
            .populate(
                'course',
                'courseCode courseName department semester examDuration'
            )
            .populate('classrooms', 'roomNumber building floor capacity')
            .lean(),

        SeatingArrangementModel.find(seatFilter)
            .populate('classroom', 'roomNumber building floor capacity')
            .lean()
    ]);

    // A student sits one course in one session, so this pair is unique.
    const seatByExam = new Map(
        seats.map((seat) => [
            `${seat.examSession}:${seat.course}`,
            seat
        ])
    );

    return timetable
        .map((entry) => {
            const seat =
                seatByExam.get(
                    `${entry.examSession?._id}:${entry.course?._id}`
                ) || null;

            return {
                _id: entry._id,
                examCycle: entry.examCycle,
                examSession: entry.examSession,
                course: entry.course,
                reportingTime: getReportingTime(entry.examSession?.startTime),
                reportingBufferMinutes: REPORTING_BUFFER_MINUTES,
                // Room is the student's own allocated room when seating has
                // been generated, otherwise the rooms planned for the course.
                classroom: seat?.classroom || null,
                plannedClassrooms: entry.classrooms || [],
                seat: seat
                    ? {
                          seatNumber: seat.seatNumber,
                          row: seat.row,
                          column: seat.column
                      }
                    : null
            };
        })
        .sort(bySessionDateThenTime);
};

// GET /students/me/overview
const getMyOverview = async (req, res) => {
    try {
        await connectDB();

        const student = await getLoggedInStudent(req, res);
        if (!student) return;

        const user = await UserModel.findById(req.user._id)
            .select('name email')
            .lean();

        const exams = await buildStudentExams(student, req.query.examCycle);

        // Exams are compared by calendar day so an exam happening today
        // still counts as upcoming.
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const upcoming = exams.filter(
            (exam) =>
                exam.examSession?.sessionDate &&
                new Date(exam.examSession.sessionDate) >= startOfToday
        );

        return res.status(200).json({
            success: true,
            profile: {
                name: user?.name || '',
                email: user?.email || '',
                studentId: student.studentId,
                department: student.department,
                semester: student.semester
            },
            totalExams: exams.length,
            upcomingExams: upcoming.length,
            seatsAllocated: exams.filter((exam) => exam.seat).length,
            nextExam: upcoming[0] || null
        });
    } catch (error) {
        console.error('Student overview error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load your dashboard.'
        });
    }
};

// GET /students/me/exam-schedule
const getMyExamSchedule = async (req, res) => {
    try {
        await connectDB();

        const student = await getLoggedInStudent(req, res);
        if (!student) return;

        const exams = await buildStudentExams(student, req.query.examCycle);

        return res.status(200).json({
            success: true,
            totalExams: exams.length,
            exams
        });
    } catch (error) {
        console.error('Student exam schedule error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load your exam schedule.'
        });
    }
};

// GET /students/me/sitting-plan
const getMySittingPlan = async (req, res) => {
    try {
        await connectDB();

        const student = await getLoggedInStudent(req, res);
        if (!student) return;

        const filter = { student: student._id };

        if (req.query.examCycle) {
            filter.examCycle = req.query.examCycle;
        }

        const seats = await SeatingArrangementModel.find(filter)
            .populate('examCycle', 'cycleName academicYear examType')
            .populate(
                'examSession',
                'sessionDate startTime endTime sessionType'
            )
            .populate('course', 'courseCode courseName')
            .populate('classroom', 'roomNumber building floor capacity')
            .lean();

        const seatingPlan = seats
            .map((seat) => ({
                _id: seat._id,
                examCycle: seat.examCycle,
                examSession: seat.examSession,
                course: seat.course,
                classroom: seat.classroom,
                seatNumber: seat.seatNumber,
                row: seat.row,
                column: seat.column,
                reportingTime: getReportingTime(seat.examSession?.startTime)
            }))
            .sort(bySessionDateThenTime);

        return res.status(200).json({
            success: true,
            totalSeats: seatingPlan.length,
            seatingPlan
        });
    } catch (error) {
        console.error('Student sitting plan error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load your sitting plan.'
        });
    }
};

// GET /students/me/exam-shifts
const getMyExamShifts = async (req, res) => {
    try {
        await connectDB();

        const student = await getLoggedInStudent(req, res);
        if (!student) return;

        const exams = await buildStudentExams(student, req.query.examCycle);

        const shifts = exams.map((exam) => ({
            _id: exam._id,
            examCycle: exam.examCycle,
            sessionDate: exam.examSession?.sessionDate || null,
            sessionType: exam.examSession?.sessionType || null,
            startTime: exam.examSession?.startTime || null,
            endTime: exam.examSession?.endTime || null,
            reportingTime: exam.reportingTime,
            reportingBufferMinutes: exam.reportingBufferMinutes,
            course: exam.course,
            classroom: exam.classroom,
            seat: exam.seat
        }));

        return res.status(200).json({
            success: true,
            totalShifts: shifts.length,
            shifts
        });
    } catch (error) {
        console.error('Student exam shifts error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load your exam shifts.'
        });
    }
};

module.exports = {
    getMyOverview,
    getMyExamSchedule,
    getMySittingPlan,
    getMyExamShifts,
    // Exported for unit testing only.
    _internal: { toMinutes, getReportingTime }
};
