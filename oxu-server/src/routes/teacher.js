const express = require('express');
const Lesson = require('../models/Lesson');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { notifyUsers, notifyAdmins } = require('../notifications');
const { todayKey } = require('../utils/date');
const attendanceWindow = require('../utils/attendance-window');
const AcademicDocument = require('../models/AcademicDocument');

const router = express.Router();
router.use(auth, requireRole('teacher', 'department_head', 'admin'));

const fmt = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

const weekDates = (weekStart) => {
  const [y, m, d] = String(weekStart).split('-').map(Number);
  return Array.from({ length: 6 }, (_, i) => fmt(new Date(y, m - 1, d + i)));
};

router.get('/department-kpi', requireRole('department_head', 'admin'), async (req, res) => {
  const head = await User.findById(req.user._id).select('department role');
  const departmentId = req.user.role === 'admin' ? req.query.departmentId : head?.department;
  if (!departmentId) return res.status(400).json({ message: 'Kafedra biriktirilmagan' });
  const teachers = await User.find({ role: { $in: ['teacher', 'department_head'] }, department: departmentId, approved: true }).select('fullName phone subjects').populate('subjects', 'name code credits hours');
  const rows = [];
  for (const teacher of teachers) {
    const lessons = await Lesson.find({ teacher: teacher._id }).select('subject');
    const present = await Attendance.countDocuments({ lesson: { $in: lessons.map((l) => l._id) }, status: 'present' });
    const absent = await Attendance.countDocuments({ lesson: { $in: lessons.map((l) => l._id) }, status: 'absent' });
    const approvedDocs = await AcademicDocument.find({ authors: teacher._id, status: 'approved' }).select('awardedScore title');
    const workload = teacher.subjects.reduce((sum, subject) => { const values = subject.hours instanceof Map ? [...subject.hours.values()] : Object.values(subject.hours || {}); return sum + values.reduce((n, v) => n + (v?.[0] || 0) + (v?.[1] || 0), 0); }, 0);
    const researchScore = approvedDocs.reduce((sum, doc) => sum + (doc.awardedScore || 0), 0);
    rows.push({ id: teacher._id, fullName: teacher.fullName, subjects: teacher.subjects.length, workload, lessons: lessons.length, present, absent, researchScore, documents: approvedDocs.length, score: Number(Math.min(10, workload / 30 + (present ? 1 : 0) + researchScore).toFixed(2)) });
  }
  rows.sort((a, b) => b.score - a.score);
  res.json({ rows, departmentId, average: rows.length ? Number((rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(2)) : 0 });
});
router.get('/all-department-kpi', requireRole('department_head', 'admin'), async (req, res) => {
  const departments = await require('../models/Department').find({ active: true }).sort({ name: 1 });
  const result = [];
  for (const department of departments) {
    const teachers = await User.find({ role: { $in: ['teacher', 'department_head'] }, department: department._id, approved: true }).select('fullName subjects').populate('subjects', 'name hours');
    const rows = [];
    for (const teacher of teachers) {
      const lessons = await Lesson.find({ teacher: teacher._id }).select('_id');
      const present = await Attendance.countDocuments({ lesson: { $in: lessons.map(l => l._id) }, status: 'present' });
      const absent = await Attendance.countDocuments({ lesson: { $in: lessons.map(l => l._id) }, status: 'absent' });
      const docs = await AcademicDocument.find({ authors: teacher._id, status: 'approved' }).select('title awardedScore createdAt publishedAt journal');
      const researchScore = docs.reduce((sum, d) => sum + (d.awardedScore || 0), 0);
      const score = Number(Math.min(10, (teacher.subjects.length * 1.5) + (present ? 1 : 0) + researchScore).toFixed(2));
      rows.push({ id: teacher._id, fullName: teacher.fullName, subjects: teacher.subjects.length, lessons: lessons.length, present, absent, researchScore, score, documents: docs });
    }
    rows.sort((a,b) => b.score - a.score);
    rows.forEach((row, i) => { row.rank = i + 1; });
    result.push({ id: department._id, name: department.name, code: department.code, average: rows.length ? Number((rows.reduce((s,r)=>s+r.score,0)/rows.length).toFixed(2)) : 0, teachers: rows });
  }
  result.sort((a,b) => b.average - a.average);
  res.json({ departments: result });
});

// Haftalik jadval (kunlar bo'yicha guruhlangan)
router.get('/schedule', async (req, res) => {
  const teacherId = req.user.role === 'admin' ? req.query.teacherId || req.user._id : req.user._id;
  const dates = weekDates(req.query.weekStart || new Date().toISOString().slice(0, 10));
  const lessons = await Lesson.find({ teacher: teacherId, date: { $in: dates } })
    .populate('subject', 'name')
    .populate('groups', 'name')
    .sort({ date: 1, startTime: 1 });

  const byDay = {};
  for (const date of dates) byDay[date] = [];
  for (const l of lessons) byDay[l.date]?.push(l);

  const total = lessons.length;
  res.json({ weekStart: dates[0], dates, byDay, total });
});

// Mening barcha darslarim (kelasi uchun — "Mening darslarim" ekrani)
router.get('/lessons', async (req, res) => {
  const filter = { teacher: req.user._id };
  if (req.query.from) filter.date = { ...filter.date, $gte: req.query.from };
  if (req.query.to) filter.date = { ...filter.date, $lte: req.query.to };
  const lessons = await Lesson.find(filter)
    .populate('subject', 'name')
    .populate('groups', 'name')
    .sort({ date: 1, startTime: 1 });
  res.json(lessons);
});

// Davomat ekrani: dars + talabalar ro'yxati + belgilangan holatlar
router.get('/lessons/:id/attendance', async (req, res) => {
  const lesson = await Lesson.findById(req.params.id).populate('subject', 'name').populate('groups', 'name');
  if (!lesson) return res.status(404).json({ message: 'Dars topilmadi' });
  if (lesson.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bu sizning darsingiz emas' });
  }

  const groupIds = lesson.groups.map((g) => g._id);
  const students = await User.find({ role: 'student', group: { $in: groupIds }, approved: true })
    .select('fullName')
    .sort({ fullName: 1 });
  const records = await Attendance.find({ lesson: lesson._id });
  const recordMap = {};
  records.forEach((r) => (recordMap[r.student.toString()] = r.status));

  res.json({
    lesson,
    attendanceLocked: Boolean(lesson.attendanceTakenAt) || records.length > 0,
    attendanceAllowed: attendanceWindow(lesson).allowed,
    attendanceMessage: attendanceWindow(lesson).message,
    attendanceTakenAt: lesson.attendanceTakenAt || null,
    students: students.map((s) => ({ id: s._id, fullName: s.fullName, status: recordMap[s._id.toString()] || null })),
  });
});

// Davomat saqlash — har bir dars uchun faqat bir marta (qaytarib bo'lmaydi)
router.put('/lessons/:id/attendance', async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).json({ message: 'Dars topilmadi' });
  if (lesson.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bu sizning darsingiz emas' });
  }
  const { records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ message: 'records massivi kerak' });
  if (lesson.attendanceTakenAt || (await Attendance.exists({ lesson: lesson._id }))) {
    return res.status(409).json({ message: 'Bu dars uchun davomat allaqachon olingan va o‘zgartirilmaydi' });
  }
  if (!attendanceWindow(lesson).allowed) return res.status(400).json({ message: attendanceWindow(lesson).message });

  const students = await User.find({ role: 'student', approved: true, group: { $in: lesson.groups } }).select('_id');
  const roster = new Set(students.map((s) => s._id.toString()));
  if (!roster.size) return res.status(400).json({ message: 'Bu dars guruhlarida talaba yo‘q' });
  const marked = new Set();
  for (const record of records) {
    if (!record || typeof record.studentId !== 'string' || !roster.has(record.studentId) ||
        !['present', 'absent'].includes(record.status) || marked.has(record.studentId)) {
      return res.status(400).json({ message: 'Davomat yozuvi noto‘g‘ri yoki talaba bu dars guruhida emas' });
    }
    marked.add(record.studentId);
  }
  if (marked.size !== roster.size) {
    return res.status(400).json({ message: `Barcha talabalarni belgilang. Belgilanmagan: ${roster.size - marked.size} ta` });
  }

  const claimed = await Lesson.findOneAndUpdate(
    { _id: lesson._id, attendanceTakenAt: null },
    { $set: { attendanceTakenAt: new Date(), attendanceTakenBy: req.user._id } },
    { new: true }
  );
  if (!claimed) return res.status(409).json({ message: 'Bu dars uchun davomat allaqachon olingan va o‘zgartirilmaydi' });

  try {
    await Attendance.bulkWrite(records.map((r) => ({
      updateOne: {
        filter: { lesson: lesson._id, student: r.studentId },
        update: { lesson: lesson._id, student: r.studentId, status: r.status, markedBy: req.user._id },
        upsert: true,
      },
    })));
  } catch (err) {
    await Attendance.deleteMany({ lesson: lesson._id, markedBy: req.user._id });
    await Lesson.updateOne({ _id: lesson._id }, { $set: { attendanceTakenAt: null, attendanceTakenBy: null } });
    throw err;
  }

  await lesson.populate('subject', 'name');
  const detail = `${lesson.subject?.name || 'Dars'} · ${lesson.date} · ${lesson.startTime}`;
  for (const status of ['present', 'absent']) {
    const ids = records.filter((record) => record.status === status).map((record) => record.studentId);
    const label = status === 'present' ? 'Qatnashdi' : 'Qatnashmadi';
    if (ids.length) await notifyUsers(ids, { actor: req.user._id, kind: 'attendance.updated', title: 'Davomatingiz qayd etildi', body: `${detail}. Holat: ${label}.`, urls: { student: '/student/attendance' }, data: { lessonId: String(lesson._id), status, target: 'attendance' } });
  }
  await notifyAdmins({ actor: req.user._id, kind: 'attendance.saved', title: 'Davomat saqlandi', body: `${detail}. Qatnashdi: ${records.filter((record) => record.status === 'present').length}, qatnashmadi: ${records.filter((record) => record.status === 'absent').length}.`, urls: { admin: '/admin/report', teacher: `/teacher/lesson/${lesson._id}/attendance` }, data: { lessonId: String(lesson._id), target: 'attendance' } }, [lesson.teacher]);

  res.json({ message: 'Davomat saqlandi', count: records.length, attendanceLocked: true, attendanceTakenAt: claimed.attendanceTakenAt });
});

// Umumiy statistika (jami/qatnashgan/qatnashmagan)
router.get('/workload', async (req, res) => {
  const teacher = await User.findById(req.user._id).populate('subjects', 'name code department direction credits hours deliveryHours');
  const lessons = await Lesson.find({ teacher: req.user._id }).populate('subject', 'name code credits hours').populate('groups', 'name');
  const rows = (teacher?.subjects || []).map((subject, index) => {
    const own = lessons.filter((lesson) => String(lesson.subject?._id) === String(subject._id));
    const hours = subject.hours || {};
    const lecture = (hours.get?.('lecture') || hours.lecture || [0, 0]).reduce((a, b) => a + b, 0);
    const practice = (hours.get?.('practice') || hours.practice || [0, 0]).reduce((a, b) => a + b, 0);
    const laboratory = (hours.get?.('lab') || hours.lab || [0, 0]).reduce((a, b) => a + b, 0);
    return { no: index + 1, id: subject._id, name: subject.name, code: subject.code, department: subject.department, direction: subject.direction, credits: subject.credits, lecture, practice, laboratory, independent: (hours.get?.('independent') || hours.independent || [0, 0]).reduce((a, b) => a + b, 0), scheduledLessons: own.length, groups: [...new Set(own.flatMap((lesson) => lesson.groups.map((group) => group.name)))] };
  });
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  res.json({ rows, totals: { total: sum('lecture') + sum('practice') + sum('laboratory'), lecture: sum('lecture'), practice: sum('practice'), laboratory: sum('laboratory'), independent: sum('independent') } });
});

router.get('/stats', async (req, res) => {
  const lessons = await Lesson.find({ teacher: req.user._id }).select('_id');
  const ids = lessons.map((l) => l._id);
  const [total, present, absent] = await Promise.all([
    Attendance.countDocuments({ lesson: { $in: ids } }),
    Attendance.countDocuments({ lesson: { $in: ids }, status: 'present' }),
    Attendance.countDocuments({ lesson: { $in: ids }, status: 'absent' }),
  ]);
  res.json({ total, present, absent });
});

module.exports = router;
