const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TeacherSchema = new Schema(
    {
        teacherId: {
            type: String,
            required: true,
            unique: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            required: true,
            unique: true
        },

        department: {
            type: String,
            required: true
        },

        designation: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

const TeacherModel = mongoose.model('teachers', TeacherSchema);

module.exports = TeacherModel;