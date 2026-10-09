const CourseEnrollmentModel = require('../Models/CourseEnrollment');
const connectDB = require('../Models/db');

const getCourseConflicts = async (req, res) => {
    try {
        await connectDB();

        const enrollments = await CourseEnrollmentModel.find()
            .populate({
                path: 'student',
                select: 'studentId'
            })
            .populate({
                path: 'course',
                select: 'courseCode courseName'
            });

        const studentCourses = {};

        // Group courses by student
        enrollments.forEach((enrollment) => {
            const studentId = enrollment.student?._id?.toString();

            if (!studentId || !enrollment.course) {
                return;
            }

            if (!studentCourses[studentId]) {
                studentCourses[studentId] = [];
            }

            studentCourses[studentId].push(enrollment.course);
        });

        const conflictMap = {};

        // Find courses taken by the same student
        Object.values(studentCourses).forEach((courses) => {

            for (let i = 0; i < courses.length; i++) {

                for (let j = i + 1; j < courses.length; j++) {

                    const course1 = courses[i];
                    const course2 = courses[j];

                    const id1 = course1._id.toString();
                    const id2 = course2._id.toString();

                    const key = [id1, id2].sort().join('_');

                    if (!conflictMap[key]) {
                        conflictMap[key] = {
                            course1: {
                                id: course1._id,
                                courseCode: course1.courseCode,
                                courseName: course1.courseName
                            },
                            course2: {
                                id: course2._id,
                                courseCode: course2.courseCode,
                                courseName: course2.courseName
                            }
                        };
                    }
                }
            }
        });

        const conflicts = Object.values(conflictMap);

        res.status(200).json({
            success: true,
            totalConflicts: conflicts.length,
            conflicts
        });

    } catch (error) {

        console.error('Get Course Conflicts Error:', error);

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getCourseConflicts
};