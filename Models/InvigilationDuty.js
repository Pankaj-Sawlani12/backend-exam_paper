const mongoose = require('mongoose');

const InvigilationDutySchema = new mongoose.Schema(
    {
        examCycle: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'examcycles', 
            required: true 
        },

        examSession: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'examsessions',
            required: true
        },

        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Teachers',
            required: true
        },

        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Classrooms',
            required: true
        },

        dutyRole: {
            type: String,
            enum: ['Invigilator', 'Chief Invigilator'],
            default: 'Invigilator'
        },

        status: {
            type: String,
            enum: ['Assigned', 'Completed', 'Cancelled'],
            default: 'Assigned'
        },

        remarks: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

// A teacher cannot have two duties in the same exam session.
InvigilationDutySchema.index(
    { examSession: 1, teacher: 1 },
    { unique: true }
);

// Prevent duplicate assignment of the same role to the same classroom.
InvigilationDutySchema.index(
    { examSession: 1, classroom: 1, teacher: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    'InvigilationDuty',
    InvigilationDutySchema
);
