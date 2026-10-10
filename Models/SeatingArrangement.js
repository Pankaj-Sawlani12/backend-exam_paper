
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const SeatingArrangementSchema = new Schema(
    {
        examCycle: {
            type: Schema.Types.ObjectId,
            ref: 'examcycles',
            required: true
        },

        examSession: {
            type: Schema.Types.ObjectId,
            ref: 'examsessions',
            required: true
        },

        course: {
            type: Schema.Types.ObjectId,
            ref: 'courses',
            required: true
        },

        classroom: {
            type: Schema.Types.ObjectId,
            ref: 'classrooms',
            required: true
        },

        student: {
            type: Schema.Types.ObjectId,
            ref: 'students',
            required: true
        },

        seatNumber: {
            type: Number,
            required: true,
            min: 1,
            max: 45
        },

        row: {
            type: Number,
            required: true,
            min: 1
        },

        column: {
            type: Number,
            required: true,
            min: 1,
            max: 6
        }
    },
    {
        timestamps: true
    }
);

// A student can occupy only one seat per exam session.
SeatingArrangementSchema.index(
    { examSession: 1, student: 1 },
    { unique: true }
);

// A seat cannot be assigned twice for the same course and session.
SeatingArrangementSchema.index(
    { examSession: 1, course: 1, classroom: 1, seatNumber: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    'seatingarrangements',
    SeatingArrangementSchema
);
