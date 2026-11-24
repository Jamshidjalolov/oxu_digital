const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    course: { type: Number, min: 1, max: 6, default: null },
    faculty: { type: String, trim: true, maxlength: 160, default: '' },
    department: { type: String, trim: true, maxlength: 160, default: '' },
    direction: { type: String, trim: true, maxlength: 180, default: '' },
    directionSourceId: { type: String, trim: true, maxlength: 80, default: '' },
    educationType: { type: String, trim: true, maxlength: 80, default: 'Kunduzgi' },
    admissionYear: { type: Number, min: 2000, max: 2100, default: null },
    semester: { type: Number, min: 1, max: 12, default: null },
    capacity: { type: Number, min: 1, max: 200, default: 30 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
