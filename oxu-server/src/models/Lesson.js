const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true }],
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    pairNumber: { type: Number, default: null },
    room: { type: String, default: '' },
    roomKey: { type: String },
    building: { type: String, default: '' },
    type: { type: String, enum: ["Ma'ruza", 'Amaliyot', 'Laboratoriya'], default: 'Amaliyot' },
    seriesId: { type: mongoose.Schema.Types.ObjectId, default: null },
    attendanceTakenAt: { type: Date, default: null },
    attendanceTakenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

lessonSchema.index({ roomKey: 1, date: 1, pairNumber: 1 }, { unique: true, partialFilterExpression: { roomKey: { $type: 'string' } } });
module.exports = mongoose.model('Lesson', lessonSchema);
