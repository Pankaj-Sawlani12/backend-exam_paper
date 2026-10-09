const CourseModel = require('../Models/Course');
const CourseEnrollmentModel = require('../Models/CourseEnrollment');
const ExamSessionModel = require('../Models/ExamSession');
const ExamCycleModel = require('../Models/ExamCycle');
const connectDB = require('../Models/db');
const TimetableModel = require('../Models/Timetable');
const ClassroomModel = require('../Models/Classroom');
const StudentModel = require('../Models/Student');


const generateTimetable = async (req, res) => {
    try {
        await connectDB();

        const { examCycle, examMode } = req.query;

        if (!examCycle) {
            return res.status(400).json({
                success: false,
                message: 'Exam cycle is required.'
            });
        }

        if (!['one', 'two'].includes(examMode)) {
            return res.status(400).json({
                success: false,
                message: 'Select one exam per day or two exams per day.'
            });
        }

        const selectedCycle = await ExamCycleModel.findById(examCycle);

        if (!selectedCycle) {
            return res.status(404).json({
                success: false,
                message: 'Exam cycle not found.'
            });
        }

        const courses = await CourseModel.find({
            semester: selectedCycle.semester
        });

        if (courses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No courses found for this semester.'
            });
        }

        // Every exam must fit within a three-hour shift.
        const invalidCourses = courses.filter(
            course => !course.examDuration ||
                      course.examDuration > 180
        );

        if (invalidCourses.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some courses have an invalid exam duration.',
                courses: invalidCourses.map(course => ({
                    courseCode: course.courseCode,
                    examDuration: course.examDuration
                }))
            });
        }

        // Build the student-course conflict graph.
        const enrollments = await CourseEnrollmentModel.find();
        
        // Load available classrooms.
        const classrooms = await ClassroomModel.find().sort({
            roomNumber: 1
        });

        if (classrooms.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No classrooms are available. Please add classrooms first.'
            });
        }

        // Count enrolled students in each course.
        const enrollmentCounts = {};

        enrollments.forEach(enrollment => {
            const courseId = enrollment.course.toString();

            enrollmentCounts[courseId] =
                (enrollmentCounts[courseId] || 0) + 1;
        });

        const courseIds = new Set(
            courses.map(course => course._id.toString())
        );

        const graph = {};
        const studentCourses = {};

        courses.forEach(course => {
            graph[course._id.toString()] = new Set();
        });

        enrollments.forEach(enrollment => {
            const studentId = enrollment.student.toString();
            const courseId = enrollment.course.toString();

            if (!courseIds.has(courseId)) return;

            if (!studentCourses[studentId]) {
                studentCourses[studentId] = new Set();
            }

            studentCourses[studentId].add(courseId);
        });

        Object.values(studentCourses).forEach(courseSet => {
            const list = [...courseSet];

            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    graph[list[i]].add(list[j]);
                    graph[list[j]].add(list[i]);
                }
            }
        });
        
        // Greedy graph coloring.
        const colors = {};

        const orderedCourses = [...courses].sort(
            (a, b) =>
                graph[b._id.toString()].size -
                graph[a._id.toString()].size
        );

        orderedCourses.forEach(course => {
            const id = course._id.toString();
            const usedColors = new Set();

            graph[id].forEach(neighborId => {
                if (colors[neighborId] !== undefined) {
                    usedColors.add(colors[neighborId]);
                }
            });

            let color = 0;
            while (usedColors.has(color)) color++;

            colors[id] = color;
        });

        const totalColors = Math.max(
            ...Object.values(colors)
        ) + 1;

        // Create available fixed shifts within the exam-cycle dates.
        const start = new Date(selectedCycle.startDate);
        const end = new Date(selectedCycle.endDate);

        const startDay = Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth(),
            start.getUTCDate()
        );

        const endDay = Date.UTC(
            end.getUTCFullYear(),
            end.getUTCMonth(),
            end.getUTCDate()
        );

        const dayMs = 24 * 60 * 60 * 1000;
        const slots = [];

        for (let day = startDay; day <= endDay; day += dayMs) {
            const date = new Date(day);

            slots.push({
                date,
                startTime: '09:30',
                endTime: '12:30',
                sessionType: 'Morning'
            });

            if (examMode === 'two') {
                slots.push({
                    date,
                    startTime: '14:00',
                    endTime: '17:00',
                    sessionType: 'Afternoon'
                });
            }
        }

        if (totalColors > slots.length) {
            return res.status(400).json({
                success: false,
                message: `Not enough exam slots. This timetable needs ${totalColors} separate slots, but only ${slots.length} are available. Extend the exam cycle or choose two exams per day.`,
                requiredSlots: totalColors,
                availableSlots: slots.length
            });
        }

        // Reuse matching sessions or create the fixed-shift sessions.
        const examSessions = [];

        for (let i = 0; i < totalColors; i++) {
            const slot = slots[i];

            let session = await ExamSessionModel.findOne({
                examCycle: selectedCycle._id,
                sessionDate: slot.date,
                startTime: slot.startTime,
                endTime: slot.endTime,
                sessionType: slot.sessionType
            });

            if (!session) {
                session = await ExamSessionModel.create({
                    examCycle: selectedCycle._id,
                    sessionDate: slot.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    sessionType: slot.sessionType
                });
            }

            examSessions.push(session);
        }

        // Assign each color to one distinct, non-overlapping shift.
        const sessionByColor = {};

        for (let color = 0; color < totalColors; color++) {
            sessionByColor[color] = examSessions[color];
        }

        const timetable = courses.map(course => {
            const color = colors[course._id.toString()];
            const session = sessionByColor[color];

            return {
                course: {
                    id: course._id,
                    courseCode: course.courseCode,
                    courseName: course.courseName,
                    department: course.department,
                    semester: course.semester
                },
                color,
                examSession: {
                    id: session._id,
                    date: session.sessionDate,
                    startTime: session.startTime,
                    endTime: session.endTime,
                    sessionType: session.sessionType
                }
            };
        });

        
        // Validate that no student has two courses in the same shift.
        const conflictingPairs = [];

        for (const courseId of Object.keys(graph)) {
            for (const neighborId of graph[courseId]) {
                if (
                    courseId < neighborId &&
                    colors[courseId] === colors[neighborId]
                ) {
                    conflictingPairs.push({
                        course1: courses.find(
                            c => c._id.toString() === courseId
                        )?.courseCode,
                        course2: courses.find(
                            c => c._id.toString() === neighborId
                        )?.courseCode
                    });
                }
            }
        }

        if (conflictingPairs.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Timetable contains student exam conflicts.',
                conflictingPairs
            });
        }
 
        // Independently verify student conflicts using actual exam sessions.
        const courseSessionMap = new Map();

        timetable.forEach(item => {
            courseSessionMap.set(
                item.course.id.toString(),
                {
                    sessionId: item.examSession.id.toString(),
                    courseCode: item.course.courseCode
                }
            );
        });

        
        // Group each student's courses by their actual exam session.
        const studentSessionCourses = new Map();

        for (const enrollment of enrollments) {
            const studentId = enrollment.student.toString();
            const courseId = enrollment.course.toString();

            const scheduledCourse = courseSessionMap.get(courseId);

            if (!scheduledCourse) continue;

            const { sessionId, courseCode } = scheduledCourse;

            if (!studentSessionCourses.has(studentId)) {
                studentSessionCourses.set(studentId, new Map());
            }

            const sessions = studentSessionCourses.get(studentId);

            if (!sessions.has(sessionId)) {
                sessions.set(sessionId, new Set());
            }

            sessions.get(sessionId).add(courseCode);
        }

        // Detect students with multiple courses in the same session.
        const studentConflicts = [];

        for (const [studentId, sessions] of studentSessionCourses) {
            for (const [sessionId, courseCodes] of sessions) {
                if (courseCodes.size > 1) {
                    studentConflicts.push({
                        studentId,
                        sessionId,
                        courses: [...courseCodes]
                    });
                }
            }
        }

        if (studentConflicts.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    'Student exam conflicts detected. Timetable was not saved.',
                totalConflicts: studentConflicts.length,
                studentConflicts
            });
        }

        console.log(
            'Student conflict verification passed.',
            'Students checked:',
            studentSessionCourses.size
        );


// Allocate classrooms after graph coloring and session assignment.
const records = [];
const classroomUsage = {};
const classroomAssignments = [];

for (const course of courses) {
    const courseId = course._id.toString();
    const color = colors[courseId];
    const session = sessionByColor[color];
    const studentCount = enrollmentCounts[courseId] || 0;

    const availableRooms = classrooms.filter(room => {
        const usageKey = `${session._id}_${room._id}`;
        return !classroomUsage[usageKey];
    });

    let remainingStudents = studentCount;
    const assignedRooms = [];

    // Assign at least one room, even if no students are enrolled yet.
    for (const room of availableRooms) {
        if (remainingStudents <= 0 && assignedRooms.length > 0) break;

        assignedRooms.push(room);
        remainingStudents -= room.capacity;
    }

    if (remainingStudents > 0) {
        return res.status(400).json({
            success: false,
            message: `Not enough classroom capacity for ${course.courseCode}.`,
            courseCode: course.courseCode,
            enrolledStudents: studentCount,
            availableCapacity: availableRooms.reduce(
                (total, room) => total + room.capacity,
                0
            )
        });
    }

    assignedRooms.forEach(room => {
        classroomUsage[`${session._id}_${room._id}`] = true;
    });

    classroomAssignments.push({
        courseCode: course.courseCode,
        enrolledStudents: studentCount,
        classrooms: assignedRooms.map(room => room.roomNumber)
    });

    records.push({
        examCycle: selectedCycle._id,
        examSession: session._id,
        course: course._id,
        classrooms: assignedRooms.map(room => room._id),
        color
    });
}


        await TimetableModel.deleteMany({
            examCycle: selectedCycle._id
        });

        await TimetableModel.insertMany(records);

        return res.status(200).json({
            success: true,
            message: 'Timetable generated successfully.',
            examMode,
            examCycle: {
                id: selectedCycle._id,
                cycleName: selectedCycle.cycleName,
                academicYear: selectedCycle.academicYear,
                semester: selectedCycle.semester,
                examType: selectedCycle.examType
            },
            totalCourses: courses.length,
            totalSessionsUsed: totalColors,
            classroomAssignments,
            timetable: timetable.map(item => {
            const assignment = classroomAssignments.find(
                room => room.courseCode === item.course.courseCode
            );

            return {
                ...item,
                classrooms: assignment ? assignment.classrooms : []
                };
            })
        });

    } catch (error) {
        console.error('Generate Timetable Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

const getTimetable = async (req, res) => {
    try {
        await connectDB();

        const { examCycle } = req.query;

        if (!examCycle) {
            return res.status(400).json({
                success: false,
                message: 'Exam cycle is required'
            });
        }

        const timetable = await TimetableModel.find({
            examCycle
        })
            .populate({
                path: 'examCycle',
                select: 'cycleName academicYear semester examType'
            })
            .populate({
                path: 'examSession',
                select: 'sessionDate startTime endTime sessionType'
            })
            .populate({
                path: 'course',
                select: 'courseCode courseName department semester examDuration'
            })
            .populate({
                path: 'classrooms',
                select: 'roomNumber building floor capacity'
            })
            .sort({ examSession: 1, course: 1 })
            .lean();

        const courseIds = timetable
            .map(item => item.course?._id)
            .filter(Boolean);

        const enrollmentCounts = await CourseEnrollmentModel.aggregate([
            {
                $match: {
                    course: { $in: courseIds }
                }
            },
            {
                $group: {
                    _id: '$course',
                    enrolledStudents: { $sum: 1 }
                }
            }
        ]);

        const countByCourse = new Map(
            enrollmentCounts.map(item => [
                item._id.toString(),
                item.enrolledStudents
            ])
        );

        const enrichedTimetable = timetable.map(item => ({
            ...item,
            enrolledStudents: item.course?._id
                ? countByCourse.get(item.course._id.toString()) || 0
                : 0
        }));

        return res.status(200).json({
            success: true,
            totalEntries: enrichedTimetable.length,
            timetable: enrichedTimetable
        });

    } catch (error) {
        console.error('Get Timetable Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};


        module.exports = {
            generateTimetable,
            getTimetable
        };
