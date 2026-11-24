const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { timingSafeEqual } = require('node:crypto');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();
const normalizePhone = (value) => typeof value === 'string' ? value.replace(/[\s()+-]/g, '').replace(/^998(?=\d{9}$)/, '') : '';
const publicUser = (user) => ({ id: user._id, fullName: user.fullName, phone: user.phone, avatar: user.avatar || '', role: user.role, group: user.group, department: user.department, approved: user.approved });
const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });

router.post('/login', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { password } = req.body;
  if (!/^\d{9}$/.test(phone) || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ message: 'Telefon va parolni to‘g‘ri kiriting' });
  }
  const user = await User.findOne({ phone }).populate('group', 'name').populate('department', 'name code');
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Telefon yoki parol noto‘g‘ri' });
  if (!user.approved) return res.status(403).json({ message: 'Hisobingiz hali admin tomonidan tasdiqlanmagan' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
router.put('/me', auth, async (req, res) => {
  if (Object.keys(req.body).some(key => !['fullName','phone','avatar','currentPassword'].includes(key))) return res.status(400).json({ message: 'Profil maydoni noto‘g‘ri' });
  const update = {};
  if (req.body.fullName !== undefined) {
    if (typeof req.body.fullName !== 'string' || req.body.fullName.trim().length < 2 || req.body.fullName.length > 120) return res.status(400).json({ message: 'Ism 2–120 belgi bo‘lsin' });
    update.fullName = req.body.fullName.trim();
  }
  if (req.body.phone !== undefined) {
    const phone = normalizePhone(req.body.phone);
    if (!/^\d{9}$/.test(phone)) return res.status(400).json({ message: '9 xonali telefon kiriting' });
    if (phone !== req.user.phone) {
      const account = await User.findById(req.user._id).select('password');
      if (typeof req.body.currentPassword !== 'string' || !await bcrypt.compare(req.body.currentPassword, account.password)) return res.status(400).json({ message: 'Telefonni almashtirish uchun joriy parolni kiriting' });
      if (await User.exists({ phone, _id: { $ne: req.user._id } })) return res.status(409).json({ message: 'Bu telefon boshqa hisobga biriktirilgan' });
    }
    update.phone = phone;
  }
  if (req.body.avatar !== undefined) {
    if (typeof req.body.avatar !== 'string' || req.body.avatar.length > 350000 || (req.body.avatar && !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(req.body.avatar))) return res.status(400).json({ message: 'JPG yoki PNG rasm tanlang (250 KB gacha)' });
    update.avatar = req.body.avatar;
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true }).populate('group', 'name');
  res.json({ user: publicUser(user) });
});
router.put('/telegram', auth, async (req, res) => {
  const expected = Buffer.from(process.env.BOT_LINK_SECRET || '');
  const supplied = Buffer.from(req.get('X-Oxu-Bot-Secret') || '');
  if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(403).json({ message: 'Telegramni faqat bot orqali bog‘lash mumkin' });
  const telegramId = req.body.telegramId;
  if (telegramId !== null && (typeof telegramId !== 'string' || !/^[1-9]\d{0,19}$/.test(telegramId))) return res.status(400).json({ message: 'Telegram ID noto‘g‘ri' });
  if (telegramId) await User.updateMany({ _id: { $ne: req.user._id }, telegramId }, { telegramId: null, telegramVerified: false });
  await User.findByIdAndUpdate(req.user._id, { telegramId, telegramVerified: Boolean(telegramId) });
  res.json({ message: telegramId ? 'Telegram bog‘landi' : 'Telegram bog‘lanishi uzildi' });
});

module.exports = router;
