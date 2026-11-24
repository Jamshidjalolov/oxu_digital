const express = require('express');
const mongoose = require('mongoose');
const AcademicDocument = require('../models/AcademicDocument');
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, requireRole } = require('../middleware/auth');
const { notifyAdmins, notifyUsers } = require('../notifications');
const router = express.Router();
router.use(auth);
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const shape = d => ({ ...d.toObject(), file: d.file?.name ? { name: d.file.name } : null });

router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { authors: req.user._id };
  const docs = await AcademicDocument.find(filter).populate('authors', 'fullName').populate('department', 'name').populate('reviewedBy', 'fullName').sort({ createdAt: -1 });
  res.json(docs.map(shape));
});
router.get('/:id/file', async (req, res) => {
  const doc = await AcademicDocument.findById(req.params.id).select('authors file status');
  if (!doc || (req.user.role !== 'admin' && !doc.authors.some(id => String(id) === String(req.user._id)))) return res.status(404).json({ message: 'Hujjat topilmadi' });
  if (!doc.file?.data) return res.status(404).json({ message: 'Fayl mavjud emas' });
  res.json({ name: doc.file.name, data: doc.file.data });
});
router.post('/', requireRole('teacher', 'department_head'), async (req, res) => {
  const { type = 'article', title, coauthorIds = [], journal, venue, authorDepartment, studentCoauthored = false, publishedAt, articleKind, impactFactor = 0, scopus = false, url, issn, pages, file } = req.body;
  if (!['article','thesis','patent','monograph','certificate'].includes(type) || typeof title !== 'string' || title.trim().length < 8) return res.status(400).json({ message: 'Hujjat turi va to‘liq nomini kiriting' });
  const ids = [...new Set([String(req.user._id), ...(Array.isArray(coauthorIds) ? coauthorIds : [])])];
  if (ids.some(id => !mongoose.isObjectIdOrHexString(id))) return res.status(400).json({ message: 'Hammualliflar noto‘g‘ri' });
  const authors = await User.find({ _id: { $in: ids }, role: { $in: ['teacher','department_head'] }, approved: true }).select('_id department');
  if (authors.length !== ids.length) return res.status(400).json({ message: 'Hammualliflar orasida faol o‘qituvchini tanlang' });
  const requestDepartment = req.user.department?._id || req.user.department;
  if (authors.some(a => a.department && requestDepartment && String(a.department) !== String(requestDepartment))) return res.status(400).json({ message: 'Hammualliflar bir kafedraga tegishli bo‘lishi kerak' });
  const numericImpact = Number(impactFactor); const numericPages = pages === '' || pages == null ? null : Number(pages);
  if (!Number.isFinite(numericImpact) || numericImpact < 0 || numericImpact > 100 || (numericPages != null && (!Number.isInteger(numericPages) || numericPages < 1))) return res.status(400).json({ message: 'Sonli maydonlar noto‘g‘ri' });
  if (['article', 'thesis', 'monograph'].includes(type) && clean(journal, 200).length < 3) return res.status(400).json({ message: `${type === 'thesis' ? 'Tezis uchun konferensiya' : type === 'monograph' ? 'Monografiya uchun nashriyot' : 'Maqola uchun jurnal'} nomi majburiy` });
  if (url && !/^https:\/\//i.test(url)) return res.status(400).json({ message: 'Havola https:// bilan boshlanishi kerak' });
  if (file && (typeof file.name !== 'string' || typeof file.data !== 'string' || file.data.length > 350000 || !/^data:application\/pdf;base64,JVBERi0/.test(file.data))) return res.status(400).json({ message: 'PDF fayl 350 KB gacha bo‘lishi kerak' });
  const kind = clean(articleKind, 120);
  const baseScore = type === 'monograph' ? 5 : type === 'article' ? 1 : type === 'thesis' ? (/xalqaro|international/i.test(kind) ? 1 : 0.5) : 0;
  const doc = await AcademicDocument.create({ type, title: title.trim(), authors: ids, department: req.user.department || null, journal: clean(journal, 200), venue: clean(venue, 200), authorDepartment: clean(authorDepartment, 160), studentCoauthored: Boolean(studentCoauthored), publishedAt: publishedAt || null, articleKind: kind, impactFactor: numericImpact, scopus: Boolean(scopus), url: clean(url, 500), issn: clean(issn, 30), pages: numericPages, file: file ? { name: clean(file.name, 150), data: file.data } : undefined, baseScore });
  await notifyAdmins({ actor: req.user._id, kind: 'document.submitted', title: 'Yangi ilmiy hujjat', body: `${req.user.fullName} “${doc.title}” hujjatini tasdiqlashga yubordi.`, urls: { admin: '/admin/documents' } });
  res.status(201).json(shape(doc));
});
router.put('/:id/review', requireRole('admin'), async (req, res) => {
  const { status, reviewNote = '' } = req.body;
  if (!['approved','rejected'].includes(status)) return res.status(400).json({ message: 'Tasdiq holati noto‘g‘ri' });
  const doc = await AcademicDocument.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Hujjat topilmadi' });
  doc.status = status; doc.reviewNote = clean(reviewNote, 500); doc.reviewedBy = req.user._id; doc.reviewedAt = new Date();
  if (status === 'approved') {
    const year = new Date(doc.publishedAt || doc.createdAt).getUTCFullYear();
    const annualLimit = doc.type === 'thesis' ? 2 : ['article', 'monograph'].includes(doc.type) ? 1 : 999;
    const prior = await AcademicDocument.countDocuments({ _id: { $ne: doc._id }, type: doc.type, status: 'approved', authors: { $in: doc.authors }, $or: [{ publishedAt: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } }, { publishedAt: null, createdAt: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } }] });
    const alreadyAwarded = prior >= annualLimit;
    doc.awardedScore = alreadyAwarded ? 0 : Number((doc.baseScore / doc.authors.length).toFixed(4));
    if (alreadyAwarded && !doc.reviewNote) doc.reviewNote = `Bu yil ushbu turdagi hujjat uchun belgilangan limit to‘lgan.`;
  } else doc.awardedScore = 0;
  await doc.save();
  await notifyUsers(doc.authors, { actor: req.user._id, kind: `document.${status}`, title: status === 'approved' ? 'Hujjat tasdiqlandi' : 'Hujjat rad etildi', body: `${doc.title} — ${status === 'approved' ? `${doc.awardedScore} ball berildi` : doc.reviewNote || 'Izoh berilmagan'}.`, urls: { teacher: '/teacher/documents' } });
  res.json(shape(doc));
});
module.exports = router;
