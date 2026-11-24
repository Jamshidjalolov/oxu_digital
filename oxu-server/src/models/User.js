const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    avatar: { type: String, default: '' },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher', 'student', 'department_head'], required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    approved: { type: Boolean, default: true },
    telegramId: { type: String, default: null },
    telegramVerified: { type: Boolean, default: false },
    notificationPreferences: {
      web: { type: Boolean, default: true },
      mobile: { type: Boolean, default: true },
      telegram: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
