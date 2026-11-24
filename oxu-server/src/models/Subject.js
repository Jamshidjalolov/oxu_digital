const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true, maxlength: 40, default: '' },
    direction: { type: String, trim: true, maxlength: 160, default: '' },
    department: { type: String, trim: true, maxlength: 160, default: '' },
    referenceSource: { type: String, maxlength: 200, default: '' },
    course: { type: Number, min: 1, max: 6, default: 1 },
    semester: { type: Number, min: 1, max: 12, default: 1 },
    block: { type: String, enum: ['Majburiy','Tanlov','Tasdiqlanmagan'], default: 'Tasdiqlanmagan' },
    description: { type: String, maxlength: 500, default: '' },
    credits: { type: Number, min: 0, max: 60, default: 0 },
    hours: { type: Map, of: [Number], default: {} },
    deliveryHours: { type: Map, of: [Number], default: {} },
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    syllabus: { name: String, data: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', subjectSchema);
