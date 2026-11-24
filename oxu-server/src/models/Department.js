const mongoose = require('mongoose');
const departmentSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true, maxlength: 160 }, code: { type: String, trim: true, maxlength: 30, default: '' }, description: { type: String, maxlength: 500, default: '' }, head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, active: { type: Boolean, default: true } }, { timestamps: true });
module.exports = mongoose.model('Department', departmentSchema);
