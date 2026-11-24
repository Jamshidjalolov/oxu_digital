const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['web', 'expo'], required: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', schema);
