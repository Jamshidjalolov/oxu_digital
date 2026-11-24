const mongoose = require('mongoose');
const schema = new mongoose.Schema({ building: { type: String, required: true, trim: true }, name: { type: String, required: true, trim: true }, key: { type: String, required: true, unique: true } }, { timestamps: true });
module.exports = mongoose.model('Room', schema);
