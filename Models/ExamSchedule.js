const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ExamScheduleSchema = new Schema(
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
        }
    },
    {
        timestamps: true
    }
);

const ExamScheduleModel = mongoose.model(
    'examschedules',
    ExamScheduleSchema
);

module.exports = ExamScheduleModel;