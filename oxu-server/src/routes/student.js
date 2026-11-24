const express = require('express');
const Lesson = require('../models/Lesson');
const Attendance = require('../models/Attendance');
const Group = require('../models/Group');
const Subject = require('../models/Subject');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Ro'yxatdan o'tish uchun ochiq ma'lumotlar
router.get('/groups', async (req, res) => {
  res.json(await Group.find().sort({ name: 1 }));
});

// Student yoki teacher uchun ochiq fanlar
router.get('/subjects', async (req, res) => {
  res.json(await Subject.find().sort({ name: 1 }));
});

router.use('/student', auth, requireRole('student'));

const fmt = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

const weekDates = (weekStart) => {
  const [y, m, d] = String(weekStart).split('-').map(Number);
  return Array.from({ length: 6 }, (_, i) => fmt(new Date(y, m - 1, d + i)));
};

// O'z guruhining haftalik jadvali
router.get('/student/schedule', async (req, res) => {
  if (!req.user.group) return res.json({ weekStart: null, dates: [], byDay: {}, total: 0 });
  const dates = weekDates(req.query.weekStart || new Date().toISOString().slice(0, 10));
  const lessons = await Lesson.find({ groups: req.user.group._id, date: { $in: dates } })
    .populate('subject', 'name')
    .populate('teacher', 'fullName')
    .sort({ date: 1, startTime: 1 });

  const myRecords = await Attendance.find({ student: req.user._id, lesson: { $in: lessons.map((l) => l._id) } });
  const statusMap = {};
  myRecords.forEach((r) => (statusMap[r.lesson.toString()] = r.status));

  const withStatus = lessons.map((l) => ({ ...l.toObject(), myStatus: statusMap[l._id.toString()] || null }));

  const byDay = {};
  for (const date of dates) byDay[date] = [];
  for (const l of withStatus) byDay[l.date]?.push(l);

  res.json({ weekStart: dates[0], dates, byDay, total: lessons.length });
});

// O'z davomat statistikasi
router.get('/student/attendance', async (req, res) => {
  const records = await Attendance.find({ student: req.user._id }).populate({
    path: 'lesson',
    populate: [{ path: 'subject', select: 'name' }],
  });
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  res.json({
    total: records.length,
    present,
    absent,
    percentage: records.length ? Math.round((present / records.length) * 100) : 0,
    records: records
      .filter((r) => r.lesson)
      .map((r) => ({
        id: r._id,
        date: r.lesson.date,
        subject: r.lesson.subject?.name,
        status: r.status,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  });
});

module.exports = router;
