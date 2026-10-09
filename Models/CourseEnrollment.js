const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CourseEnrollmentSchema = new Schema(
    {
        student: {
            type: Schema.Types.ObjectId,
            ref: 'students',
            required: true
        },

        course: {
            type: Schema.Types.ObjectId,
            ref: 'courses',
            required: true
        }
    },
    { timestamps: true }
);

// Same student cannot enroll in the same course twice
CourseEnrollmentSchema.index(
    { student: 1, course: 1 },
    { unique: true }
);

const CourseEnrollmentModel = mongoose.model(
    'courseenrollments',
    CourseEnrollmentSchema
);

module.exports = CourseEnrollmentModel;