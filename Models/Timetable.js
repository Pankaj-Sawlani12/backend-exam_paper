const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TimetableSchema = new Schema(
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

        classrooms: [
            {
                type: Schema.Types.ObjectId,
                ref: 'classrooms'
            }
        ],

        color: {
            type: Number,
            required: true
        }
    },
    { timestamps: true }
);

const TimetableModel = mongoose.model(
    'timetables',
    TimetableSchema
);

module.exports = TimetableModel;