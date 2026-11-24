const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  notification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: String, enum: ['web', 'expo', 'telegram'], required: true },
  destination: { type: String, required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'PushSubscription' },
  state: { type: String, enum: ['pending', 'receipt', 'delivered', 'skipped', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  receiptChecks: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lockedUntil: { type: Date, default: () => new Date(0) },
  ticketId: String,
  errorCode: String,
}, { timestamps: true });

schema.index({ notification: 1, channel: 1, destination: 1 }, { unique: true });
schema.index({ state: 1, nextAttemptAt: 1, lockedUntil: 1 });
module.exports = mongoose.model('NotificationDelivery', schema);
