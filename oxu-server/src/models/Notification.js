const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  kind: { type: String, required: true },
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 2000 },
  url: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: { type: Date, default: null },
  queued: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ user: 1, createdAt: -1 });
schema.index({ queued: 1, createdAt: 1 });
module.exports = mongoose.model('Notification', schema);
