const connectDB = require('../Models/db');
const InvigilationDutyModel = require('../Models/InvigilationDuty');
const TeacherModel = require('../Models/Teacher');
const ExamSessionModel = require('../Models/ExamSession');
const ExamCycleModel = require('../Models/ExamCycle');
const ClassroomModel = require('../Models/Classroom');

const getSessionDateKey = (session) => {
    if (!session?.sessionDate) return null;

    const date = new Date(session.sessionDate);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().slice(0, 10);
};

const getMinutes = (time) => {
    if (!time) return null;

    const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) return null;

    return hours * 60 + minutes;
};

const hasTimeClash = (sessionA, sessionB) => {
    const dateA = getSessionDateKey(sessionA);
    const dateB = getSessionDateKey(sessionB);

    if (!dateA || !dateB) return true;

    // Different dates cannot overlap.
    if (dateA !== dateB) return false;

    const startA = getMinutes(sessionA.startTime);
    const endA = getMinutes(sessionA.endTime);
    const startB = getMinutes(sessionB.startTime);
    const endB = getMinutes(sessionB.endTime);

    // Fail safely if session timings are invalid.
    if (
        startA === null || endA === null ||
        startB === null || endB === null ||
        startA >= endA || startB >= endB
    ) {
        return true;
    }

    // Back-to-back duties are allowed; overlapping duties are not.
    return startA < endB && startB < endA;
};

const generateInvigilationDuties = async (req, res) => {
    try {
        console.log("UPDATED DUTY GENERATOR RUNNING");
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

// Load duties from other exam cycles to prevent cross-cycle clashes.
// Cancelled duties do not block a teacher's availability.
const existingDuties = await InvigilationDutyModel.find({
    examCycle: { $ne: examCycle },
    status: { $ne: 'Cancelled' }
})
    .populate('examSession')
    .lean();

const existingDutiesByTeacher = new Map();

for (const duty of existingDuties) {
    const teacherId = duty.teacher.toString();

    if (!existingDutiesByTeacher.has(teacherId)) {
        existingDutiesByTeacher.set(teacherId, []);
    }

    existingDutiesByTeacher.get(teacherId).push(duty);
}

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
            console.log(
    "SESSION DATE KEYS:",
    sessions.map(item => ({
        date: item.session.sessionDate,
        type: item.session.sessionType,
        dateKey: getSessionDateKey(item.session)
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
        const teacherAssignedDates = new Set();

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
    .filter((teacher) => {
        const teacherId = teacher._id.toString();
        const dateKey = getSessionDateKey(session);

        if (!dateKey) {
            return false;
        }

        const assignmentKey = `${teacherId}_${dateKey}`;

        if (teacherAssignedDates.has(assignmentKey)) {
            return false;
        }

        const generatedDuties = duties.filter(
            duty => duty.teacher.toString() === teacherId
        );

        const savedDuties =
            existingDutiesByTeacher.get(teacherId) || [];

        const allTeacherDuties = [
            ...generatedDuties,
            ...savedDuties
        ];

        for (const duty of allTeacherDuties) {
            let assignedSession;

            if (
                duty.examSession &&
                typeof duty.examSession === 'object' &&
                duty.examSession.sessionDate
            ) {
                assignedSession = duty.examSession;
            } else {
                const sessionId = duty.examSession?.toString();

                assignedSession = sessions.find(
                    item =>
                        item.session._id.toString() === sessionId
                )?.session;
            }

            if (!assignedSession) {
                return false;
            }

            // Maximum one invigilation duty per calendar day.
            if (
                getSessionDateKey(assignedSession) ===
                getSessionDateKey(session)
            ) {
                return false;
            }

            // Also prevent overlapping duties.
            if (hasTimeClash(session, assignedSession)) {
                return false;
            }
        }

        return true;
    })
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
        const assignmentKey =
        `${teacher._id.toString()}_${getSessionDateKey(session)}`;

        teacherAssignedDates.add(assignmentKey);

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

            const { examCycle } = req.query;
            const filter = {};

            // Teachers can retrieve only their own duties.
            if (req.user.role === 'teacher') {
                const teacher = await TeacherModel.findOne({
                    user: req.user._id
                }).lean();

                if (!teacher) {
                    return res.status(404).json({
                        success: false,
                        message: 'Teacher profile not found.'
                    });
                }

                filter.teacher = teacher._id;
            } else if (req.user.role === 'admin') {
                // Admins may optionally filter by a teacher.
                if (req.query.teacher) {
                    filter.teacher = req.query.teacher;
                }
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: insufficient permissions.'
                });
            }

            if (examCycle) {
                filter.examCycle = examCycle;
            }

            const duties = await InvigilationDutyModel.find(filter)
                .populate(
                    'examCycle',
                    'cycleName academicYear semester examType'
                )
                .populate(
                    'examSession',
                    'sessionDate startTime endTime sessionType'
                )
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
                message: 'Failed to retrieve invigilation duties.'
            });
        }
    };


module.exports = {
    generateInvigilationDuties,
    getInvigilationDuties
};
