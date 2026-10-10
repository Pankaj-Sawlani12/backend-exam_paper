const connectDB = require('../Models/db');
const SeatingArrangementModel = require('../Models/SeatingArrangement');
const TimetableModel = require('../Models/Timetable');
const CourseEnrollmentModel = require('../Models/CourseEnrollment');

const ROOM_LIMIT = 45;
const COLUMN_COUNT = 6;

const generateSeatingArrangement = async (req, res) => {
    try {
        await connectDB();
        const { examCycle } = req.query;

        if (!examCycle) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an examCycle ID.'
            });
        }

        // Get the saved timetable and its allocated classrooms.
        const timetable = await TimetableModel.find({ examCycle })
            .populate('examSession')
            .populate('course')
            .populate('classrooms')
            .lean();

        if (timetable.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No saved timetable found for this exam cycle.'
            });
        }

        const seatingRecords = [];
        const assignedStudentsBySession = new Map();

        for (const item of timetable) {
            if (
                !item.course ||
                !item.examSession ||
                !item.classrooms?.length
            ) {
                continue;
            }

            // Get actual students enrolled in this course.
            const enrollments = await CourseEnrollmentModel.find({
                course: item.course._id
            })
                .populate('student')
                .lean();

            const students = enrollments
                .map(enrollment => enrollment.student)
                .filter(Boolean)
                .sort((a, b) =>
                    a.studentId.localeCompare(b.studentId)
                );

            // Prevent duplicate student assignments within this session.
            const uniqueStudents = [
                ...new Map(
                    students.map(student => [
                        student._id.toString(),
                        student
                    ])
                ).values()
            ];

            // Prevent a student from being assigned to different
// courses in the same exam session.
const sessionId = item.examSession._id.toString();

for (const student of uniqueStudents) {
    const key = `${sessionId}:${student._id.toString()}`;
    const courseId = item.course._id.toString();

    const existingCourse = assignedStudentsBySession.get(key);

    if (existingCourse && existingCourse !== courseId) {
        return res.status(409).json({
            success: false,
            message:
                `Scheduling conflict: student ${student.studentId} ` +
                `is enrolled in multiple courses scheduled in the same ` +
                `exam session. Conflicting course: ${item.course.courseCode}. ` +
                `Please regenerate the timetable first.`
        });
    }

    assignedStudentsBySession.set(key, courseId);
}

            // Use the allocated classrooms in a predictable order.
            const rooms = [...item.classrooms].sort((a, b) =>
                a.roomNumber.localeCompare(b.roomNumber)
            );

            let studentIndex = 0;

            for (const room of rooms) {
                if (studentIndex >= uniqueStudents.length) {
                    break;
                }

                // Respect both the project limit and room capacity.
                const roomCapacity = Math.min(
                    ROOM_LIMIT,
                    Number(room.capacity || ROOM_LIMIT)
                );

                if (roomCapacity < 1) {
                    continue;
                }

                for (
                    let seatNumber = 1;
                    seatNumber <= roomCapacity &&
                    studentIndex < uniqueStudents.length;
                    seatNumber++
                ) {
                    const student = uniqueStudents[studentIndex];

                    seatingRecords.push({
                        examCycle: item.examCycle,
                        examSession: item.examSession._id,
                        course: item.course._id,
                        classroom: room._id,
                        student: student._id,
                        seatNumber,
                        row: Math.floor(
                            (seatNumber - 1) / COLUMN_COUNT
                        ) + 1,
                        column: ((seatNumber - 1) % COLUMN_COUNT) + 1
                    });

                    studentIndex++;
                }
            }

            if (studentIndex < uniqueStudents.length) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Insufficient allocated room capacity for ` +
                        `${item.course.courseCode}. ` +
                        `${uniqueStudents.length - studentIndex} ` +
                        `student(s) could not be assigned.`
                });
            }
        }

        // Replace the existing seating plan only after validation.
        await SeatingArrangementModel.deleteMany({ examCycle });

        if (seatingRecords.length > 0) {
            await SeatingArrangementModel.insertMany(seatingRecords);
        }

        return res.status(201).json({
            success: true,
            message: 'Seating arrangement generated successfully.',
            totalSeatsAssigned: seatingRecords.length,
            seatingArrangement: seatingRecords
        });
    } catch (error) {
        console.error('Seating arrangement error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to generate seating arrangement.',
            error: error.message
        });
    }
};

const getSeatingArrangement = async (req, res) => {
    try {
        await connectDB();
        const { examCycle, course, classroom } = req.query;

        if (!examCycle) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an examCycle ID.'
            });
        }

        const filter = { examCycle };

        if (course) filter.course = course;
        if (classroom) filter.classroom = classroom;

        const seatingArrangement = await SeatingArrangementModel.find(filter)
            .populate('examSession', 'sessionDate startTime endTime sessionType')
            .populate('course', 'courseCode courseName')
            .populate('classroom', 'roomNumber capacity')
            .populate('student', 'studentId')
            .sort({ classroom: 1, seatNumber: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            totalSeatsAssigned: seatingArrangement.length,
            seatingArrangement
        });
    } catch (error) {
        console.error('Get seating arrangement error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve seating arrangement.',
            error: error.message
        });
    }
};

module.exports = {
    generateSeatingArrangement,
    getSeatingArrangement
};
