const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Subscription = require('../models/PushSubscription');
const { preferences, webConfigured } = require('../notifications');

const router = express.Router();
router.use(auth);
router.post('/test', require('express-rate-limit').rateLimit({ windowMs:300000,limit:3,keyGenerator:req=>String(req.user._id),standardHeaders:true,legacyHeaders:false,message:{message:'Sinov xabari uchun 5 daqiqa kuting'} }), async(req,res)=>{
  const prefs=preferences(req.user);
  const destinations=await Subscription.find({user:req.user._id}).select('type');
  const available=destinations.some(s=>s.type==='web'?prefs.web&&webConfigured():prefs.mobile);
  if(!available)return res.status(409).json({message:'Avval ushbu brauzer yoki APK ilovada pushni yoqing.'});
  await require('../notifications').notifyUsers([req.user._id],{kind:'push.test',title:'Push bildirishnoma sinovi',body:'OXU Digital: push kanalingizga sinov xabari yuborildi. Dars va davomat yangiliklari ham shu yerda keladi.',urls:{[req.user.role]:`/${req.user.role}`}});
  res.status(202).json({message:'Sinov xabari navbatga qo‘shildi. Qurilmaga yetkazilishini tekshiring.'});
});

router.get('/config', (req, res) => res.json({
  webPush: { configured: webConfigured(), publicKey: webConfigured() ? process.env.VAPID_PUBLIC_KEY : null },
  expoPush: { configured: true },
  telegram: { configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.BOT_LINK_SECRET), linked: Boolean(req.user.telegramId && req.user.telegramVerified) },
  preferences: preferences(req.user),
}));

router.get('/', async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.before) {
    if (typeof req.query.before !== 'string' || !mongoose.isObjectIdOrHexString(req.query.before)) return res.status(400).json({ message: 'Bildirishnoma kursori noto‘g‘ri' });
    filter._id = { $lt: req.query.before };
  }
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).select('-queued -actor -user').sort({ _id: -1 }).limit(50).lean(),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ items, unreadCount, nextCursor: items.length === 50 ? String(items.at(-1)._id) : null });
});

router.put('/preferences', async (req, res) => {
  const fields = Object.keys(req.body);
  if (!fields.length || fields.some((key) => !['web', 'mobile', 'telegram'].includes(key) || typeof req.body[key] !== 'boolean')) return res.status(400).json({ message: 'Bildirishnoma sozlamalari noto‘g‘ri' });
  const update = Object.fromEntries(fields.map((key) => [`notificationPreferences.${key}`, req.body[key]]));
  const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true });
  res.json({ preferences: preferences(user) });
});

function validWeb(subscription) {
  if (!subscription || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) return false;
  let url;
  try { url = new URL(subscription.endpoint); } catch { return false; }
  const allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com'];
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !(allowed.includes(url.hostname) || url.hostname.endsWith('.notify.windows.com'))) return false;
  const { p256dh, auth: secret } = subscription.keys || {};
  return typeof p256dh === 'string' && typeof secret === 'string' && /^[A-Za-z0-9_-]{86,88}={0,2}$/.test(p256dh) && /^[A-Za-z0-9_-]{22,24}={0,2}$/.test(secret) && Buffer.from(p256dh, 'base64url').length === 65 && Buffer.from(secret, 'base64url').length === 16;
}

const validExpo = (token) => typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(token);

router.post('/subscriptions', async (req, res) => {
  const { type, subscription, token } = req.body;
  if ((type === 'web' && !validWeb(subscription)) || (type === 'expo' && !validExpo(token)) || !['web', 'expo'].includes(type)) return res.status(400).json({ message: 'Push obunasi noto‘g‘ri' });
  if (type === 'web' && !webConfigured()) return res.status(503).json({ message: 'Web push serverda hali sozlanmagan' });
  const endpoint = type === 'web' ? subscription.endpoint : token;
  const existing = await Subscription.findOne({ endpoint });
  if (!existing && await Subscription.countDocuments({ user: req.user._id }) >= 20) return res.status(400).json({ message: 'Qurilmalar soni chegarasiga yetildi' });
  await Subscription.findOneAndUpdate({ endpoint }, { $set: { user: req.user._id, type, endpoint, ...(type === 'web' ? { keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } } : {}) } }, { upsert: true, new: true, runValidators: true });
  res.status(201).json({ message: 'Push bildirishnomalar yoqildi' });
});

router.delete('/subscriptions', async (req, res) => {
  const { type, endpoint, token } = req.body;
  const destination = type === 'web' ? endpoint : token;
  if (!['web', 'expo'].includes(type) || typeof destination !== 'string' || !destination || destination.length > 2048) return res.status(400).json({ message: 'Push obunasi noto‘g‘ri' });
  await Subscription.deleteOne({ user: req.user._id, type, endpoint: destination });
  res.json({ message: 'Qurilma obunasi uzildi' });
});

router.put('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ message: 'Barcha bildirishnomalar o‘qildi' });
});

router.put('/:id/read', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: 'Bildirishnoma ID noto‘g‘ri' });
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id, readAt: null }, { readAt: new Date() }, { new: true }).select('-queued -actor -user');
  if (!notification) {
    const existing = await Notification.findOne({ _id: req.params.id, user: req.user._id }).select('-queued -actor -user');
    if (!existing) return res.status(404).json({ message: 'Bildirishnoma topilmadi' });
    return res.json(existing);
  }
  res.json(notification);
});

module.exports = router;
