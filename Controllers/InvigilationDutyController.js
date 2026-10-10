
const connectDB = require('../Models/db');
const InvigilationDutyModel = require('../Models/InvigilationDuty');
const TeacherModel = require('../Models/Teacher');
const ExamSessionModel = require('../Models/ExamSession');
const ExamCycleModel = require('../Models/ExamCycle');
const ClassroomModel = require('../Models/Classroom');

const generateInvigilationDuties = async (req, res) => {
    try {
        await connectDB();

        const { examCycle } = req.query;

        if (!examCycle) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an examCycle ID.'
            });
        }

        const cycle = await ExamCycleModel.findById(examCycle).lean();

        if (!cycle) {
            return res.status(404).json({
                success: false,
                message: 'Exam cycle not found.'
            });
        }

        
const TimetableModel = require('../Models/Timetable');

// Get only exam sessions and classrooms used by the saved timetable.
const timetable = await TimetableModel.find({ examCycle })
    .populate('examSession')
    .populate('classrooms')
    .lean();

const sessionRooms = new Map();

for (const item of timetable) {
    if (!item.examSession || !item.classrooms?.length) {
        continue;
    }

    const sessionId = item.examSession._id.toString();

    if (!sessionRooms.has(sessionId)) {
        sessionRooms.set(sessionId, {
            session: item.examSession,
            classrooms: new Map()
        });
    }

    for (const room of item.classrooms) {
        sessionRooms.get(sessionId).classrooms.set(
            room._id.toString(),
            room
        );
    }
}

const sessions = Array.from(sessionRooms.values());


        const teachers = await TeacherModel.find()
            .populate('user', 'name email')
            .sort({ teacherId: 1 })
            .lean();
        
            console.log("TEACHER COUNT:", teachers.length);
            console.log(
                "TEACHER IDS:",
                teachers.map(teacher => teacher.teacherId)
            );
            console.log(
                "SESSION ROOM COUNTS:",
                sessions.map(item => ({
                    date: item.session.sessionDate,
                    type: item.session.sessionType,
                    rooms: item.classrooms.size
                }))
            );

        const classrooms = await ClassroomModel.find()
            .sort({ roomNumber: 1 })
            .lean();

        if (!sessions.length || !teachers.length || !classrooms.length) {
            return res.status(400).json({
                success: false,
                message:
                    'At least one exam session, teacher, and classroom are required.'
            });
        }

        const duties = [];
        const teacherDutyCounts = new Map();

        teachers.forEach(teacher => {
            teacherDutyCounts.set(teacher._id.toString(), 0);
        });

        // Generate a duty for each classroom in each exam session.
       for (const sessionData of sessions) {
    const session = sessionData.session;
    const classroomsForSession = Array.from(
        sessionData.classrooms.values()
    );

    for (const classroom of classroomsForSession) {
        const availableTeachers = teachers
            .filter(teacher =>
                !duties.some(duty =>
                    duty.examSession.toString() ===
                        session._id.toString() &&
                    duty.teacher.toString() ===
                        teacher._id.toString()
                )
            )
            .sort((a, b) =>
                teacherDutyCounts.get(a._id.toString()) -
                teacherDutyCounts.get(b._id.toString())
            );

        if (!availableTeachers.length) {
            return res.status(400).json({
                success: false,
                message:
                    `Not enough teachers for session ` +
                    `${session.sessionDate} ${session.sessionType}. ` +
                    `Required classrooms: ${classroomsForSession.length}.`
            });
        }

        const teacher = availableTeachers[0];

        duties.push({
            examCycle,
            examSession: session._id,
            teacher: teacher._id,
            classroom: classroom._id,
            dutyRole: 'Invigilator',
            status: 'Assigned'
        });

        teacherDutyCounts.set(
            teacher._id.toString(),
            teacherDutyCounts.get(teacher._id.toString()) + 1
        );
    }
}

        // Save the new plan only after all assignments are validated.
        const dbSession = await InvigilationDutyModel.startSession();

        try {
            await dbSession.withTransaction(async () => {
                await InvigilationDutyModel.deleteMany(
                    { examCycle },
                    { session: dbSession }
                );

                await InvigilationDutyModel.insertMany(
                    duties,
                    { session: dbSession }
                );
            });
        } finally {
            await dbSession.endSession();
        }

        return res.status(201).json({
            success: true,
            message: 'Invigilation duties generated successfully.',
            totalDuties: duties.length,
            duties
        });
    } catch (error) {
        console.error('Generate invigilation duties error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to generate invigilation duties.',
            error: error.message
        });
    }
};

const getInvigilationDuties = async (req, res) => {
    try {
        await connectDB();

        const { examCycle, teacher } = req.query;
        const filter = {};

        if (examCycle) filter.examCycle = examCycle;
        if (teacher) filter.teacher = teacher;

        const duties = await InvigilationDutyModel.find(filter)
            .populate('examCycle', 'cycleName academicYear semester examType')
            .populate('examSession', 'sessionDate startTime endTime sessionType')           
            .populate({
                path: 'teacher',
                model: 'teachers',
                populate: {
                    path: 'user',
                    model: 'users',
                    select: 'name email'
                }
            })
            .populate({
                path: 'classroom',
                model: 'classrooms'
            })
            .sort({ examSession: 1, classroom: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            totalDuties: duties.length,
            duties
        });
    } catch (error) {
        console.error('Get invigilation duties error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve invigilation duties.',
            error: error.message
        });
    }
};

module.exports = {
    generateInvigilationDuties,
    getInvigilationDuties
};
