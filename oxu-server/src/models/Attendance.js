const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['present', 'absent'], required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ lesson: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
