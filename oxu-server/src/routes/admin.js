const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Department = require("../models/Department");
const Lesson = require("../models/Lesson");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const { auth, requireRole } = require("../middleware/auth");
const { notifyAdmins, notifyLesson } = require("../notifications");
const { todayKey, addDaysKey } = require("../utils/date");
const Subscription = require("../models/PushSubscription");

const router = express.Router();
router.use(auth, requireRole("admin"));
router.use((req, res, next) => {
  for (const key of [
    "fullName",
    "phone",
    "password",
    "role",
    "name",
    "date",
    "startTime",
    "endTime",
    "room",
    "building",
    "type",
  ]) {
    if (req.body[key] !== undefined && typeof req.body[key] !== "string")
      return res.status(400).json({ message: "Maydon formati noto‘g‘ri" });
  }
  if (req.body.role && !["admin", "teacher", "student", "department_head"].includes(req.body.role))
    return res.status(400).json({ message: "Noto‘g‘ri rol" });
  if (req.body.approved !== undefined && typeof req.body.approved !== "boolean")
    return res.status(400).json({ message: "Tasdiqlash holati noto‘g‘ri" });
  if (
    req.body.password !== undefined &&
    (req.body.password.length < 6 || Buffer.byteLength(req.body.password) > 72)
  )
    return res
      .status(400)
      .json({
        message: "Parol kamida 6 belgi va ko‘pi bilan 72 UTF-8 bayt bo‘lsin",
      });
  if (req.body.phone !== undefined) {
    req.body.phone = req.body.phone
      .replace(/[\s()+-]/g, "")
      .replace(/^998(?=\d{9}$)/, "");
    if (!/^\d{9}$/.test(req.body.phone))
      return res.status(400).json({ message: "9 xonali telefon kiriting" });
  }
  next();
});

const fmt = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

// Standart para vaqtlari — dars faqat shu bo'sh slotlarga biriktiriladi
const PAIR_TIMES = [
  { pairNumber: 1, startTime: "08:30", endTime: "09:50" },
  { pairNumber: 2, startTime: "10:00", endTime: "11:20" },
  { pairNumber: 3, startTime: "11:30", endTime: "12:50" },
  { pairNumber: 4, startTime: "12:50", endTime: "14:10" },
  { pairNumber: 5, startTime: "14:20", endTime: "15:40" },
  { pairNumber: 6, startTime: "15:50", endTime: "17:10" },
  { pairNumber: 7, startTime: "17:20", endTime: "18:40" },
  { pairNumber: 8, startTime: "18:50", endTime: "20:10" },
  { pairNumber: 9, startTime: "20:20", endTime: "21:40" },
];

const isValidDate = (date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date + "T00:00:00Z")) &&
  new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date;

// Dars faqat ertadan boshlab biriktiriladi — bugun va o'tgan kunlar yopiq
const isAssignableDate = (date) => date >= addDaysKey(todayKey(), 1);

// Vaqt zonasi siljishiga chidamli: "2026-11-09" + i kun
const weekDates = (weekStart) => {
  const [y, m, d] = String(weekStart).split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => fmt(new Date(y, m - 1, d + i)));
};

// Haftalik takrorlanish: dars qaysi haftadan boshlab necha haftaga yoziladi
const RECUR_WEEKS = 16;
const shiftDate = (date, days) => {
  const [y, m, d] = String(date).split("-").map(Number);
  return fmt(new Date(y, m - 1, d + days));
};

const LESSON_TYPES = ["Ma'ruza", "Amaliyot", "Laboratoriya"];

// O'qituvchiga fan biriktirish (rol berishda majburiy)
async function resolveTeacherSubjects(raw) {
  const ids = Array.isArray(raw) ? [...new Set(raw)] : null;
  if (!ids) return { ids: null };
  if (
    ids.some(
      (id) => typeof id !== "string" || !mongoose.isObjectIdOrHexString(id),
    )
  )
    return { error: "Fanlar noto‘g‘ri tanlangan" };
  if (
    ids.length &&
    (await Subject.countDocuments({ _id: { $in: ids } })) !== ids.length
  )
    return { error: "Tanlangan fan topilmadi" };
  return { ids };
}

// ---------- USERS ----------
router.get("/users", async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter)
    .select("-password")
    .populate("group", "name")
    .populate("subjects", "name")
    .populate("department", "name code")
    .sort({ role: 1, fullName: 1 });
  res.json(users);
});

router.post("/users", async (req, res) => {
  const {
    fullName,
    phone,
    password,
    role,
    groupId,
    approved = true,
  } = req.body;
  if (!fullName || !phone || !password || !role) {
    return res.status(400).json({ message: "Barcha maydonlarni to‘ldiring" });
  }
  if (
    role === "student" &&
    (typeof groupId !== "string" ||
      !mongoose.isObjectIdOrHexString(groupId) ||
      !(await Group.exists({ _id: groupId })))
  )
    return res
      .status(400)
      .json({ message: "Talaba uchun mavjud guruhni tanlang" });
  if (await User.findOne({ phone })) {
    return res.status(409).json({ message: "Bu telefon band" });
  }
  const subjects = await resolveTeacherSubjects(req.body.subjectIds);
  if (subjects.error) return res.status(400).json({ message: subjects.error });
  if (["teacher", "department_head"].includes(role) && !subjects.ids?.length)
    return res
      .status(400)
      .json({ message: "O‘qituvchi uchun kamida bitta fan tanlang" });
  const departmentId = req.body.departmentId;
  if (["teacher", "department_head"].includes(role) && (!departmentId || !mongoose.isObjectIdOrHexString(departmentId) || !(await Department.exists({ _id: departmentId, active: true })))) return res.status(400).json({ message: "O‘qituvchi uchun kafedrani tanlang" });
  const user = await User.create({
    fullName,
    phone,
    password: await bcrypt.hash(password, 10),
    role,
    approved,
    group: role === "student" ? groupId : null,
    department: ["teacher", "department_head"].includes(role) ? departmentId : null,
    subjects: ["teacher", "department_head"].includes(role) ? subjects.ids : [],
  });
  await user.populate([
    { path: "subjects", select: "name" },
    { path: "group", select: "name" },
    { path: "department", select: "name code" },
  ]);
  const result = user.toObject();
  delete result.password;
  await notifyAdmins(
    {
      actor: req.user._id,
      kind: "user.created",
      title: "Yangi hisob yaratildi",
      body: `${user.fullName} uchun ${user.role} hisobi yaratildi.`,
      urls: { admin: "/admin/users" },
    },
    [user._id],
  );
  res.status(201).json(result);
});

router.put("/users/:id", async (req, res) => {
  const { fullName, phone, role, groupId, approved } = req.body;
  const update = { fullName, phone, role };
  if (["teacher", "department_head"].includes(role) && req.body.departmentId) {
    if (!mongoose.isObjectIdOrHexString(req.body.departmentId) || !(await Department.exists({ _id: req.body.departmentId, active: true }))) return res.status(400).json({ message: "Kafedra topilmadi" });
    update.department = req.body.departmentId;
  } else if (role && !["teacher", "department_head"].includes(role)) update.department = null;
  if (
    req.params.id === req.user._id.toString() &&
    ((role && role !== "admin") || approved === false)
  )
    return res
      .status(400)
      .json({ message: "O‘z admin hisobingizni cheklay olmaysiz" });
  if (role === "student") {
    if (
      groupId !== undefined &&
      (typeof groupId !== "string" ||
        !mongoose.isObjectIdOrHexString(groupId) ||
        !(await Group.exists({ _id: groupId })))
    )
      return res.status(400).json({ message: "Guruh topilmadi" });
    if (groupId) update.group = groupId;
  } else if (role) update.group = null;
  if (typeof approved === "boolean") update.approved = approved;
  const subjects = await resolveTeacherSubjects(req.body.subjectIds);
  if (subjects.error) return res.status(400).json({ message: subjects.error });
  if (["teacher", "department_head"].includes(role) && subjects.ids) update.subjects = subjects.ids;
  if (role && !["teacher", "department_head"].includes(role)) update.subjects = [];
  if (req.body.password)
    update.password = await bcrypt.hash(req.body.password, 10);
  const previous = await User.findById(req.params.id).select("-password");
  if (!previous)
    return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
  if (
    (role === "teacher" || (previous.role === "teacher" && subjects.ids)) &&
    !(subjects.ids || previous.subjects || []).length
  )
    return res
      .status(400)
      .json({ message: "O‘qituvchiga avval kamida bitta fan biriktiring" });
  if (previous.role === "teacher" && subjects.ids && !role)
    update.subjects = subjects.ids;
  const user = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  }).select("-password");
  const labels = {
    fullName: "F.I.Sh",
    phone: "telefon",
    role: "rol",
    group: "guruh",
    subjects: "fanlar",
    approved: "faollik",
    password: "parol",
  };
  const changed = Object.keys(update).filter(
    (key) =>
      update[key] !== undefined &&
      (key === "password" ||
        String(previous[key] ?? "") !== String(user[key] ?? "")),
  );
  if (changed.length)
    await notifyAdmins(
      {
        actor: req.user._id,
        kind: "user.updated",
        title: "Hisob yangilandi",
        body: `${user.fullName}: ${changed.map((key) => labels[key]).join(", ")} o‘zgartirildi.`,
        urls: { admin: "/admin/users" },
      },
      [user._id],
    );
  res.json(user);
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user._id.toString())
    return res
      .status(400)
      .json({ message: "O‘z hisobingizni o‘chira olmaysiz" });
  const user = await User.findById(req.params.id);
  if (!user)
    return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
  const lessonIds = await Lesson.distinct("_id", { teacher: user._id });
  await Attendance.deleteMany({
    $or: [
      { student: user._id },
      { markedBy: user._id },
      { lesson: { $in: lessonIds } },
    ],
  });
  await Lesson.deleteMany({ teacher: user._id });
  await Subscription.deleteMany({ user: user._id });
  await require("../models/NotificationDelivery").deleteMany({
    user: user._id,
  });
  await require("../models/Notification").deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });
  await notifyAdmins({
    actor: req.user._id,
    kind: "user.deleted",
    title: "Hisob o‘chirildi",
    body: `${user.fullName} hisobi o‘chirildi.`,
    urls: { admin: "/admin/users" },
  });
  res.json({ message: "O‘chirildi" });
});

// ---------- DEPARTMENTS ----------
router.get("/departments", async (req, res) => {
  const departments = await Department.find().populate("head", "fullName phone").sort({ name: 1 });
  res.json(departments);
});
router.post("/departments", async (req, res) => {
  const { name, code = "", description = "" } = req.body;
  if (typeof name !== "string" || name.trim().length < 2) return res.status(400).json({ message: "Kafedra nomini kiriting" });
  const department = await Department.create({ name: name.trim(), code, description });
  res.status(201).json(department);
});
router.put("/departments/:id", async (req, res) => {
  const update = {};
  for (const key of ["name", "code", "description"]) if (req.body[key] !== undefined) update[key] = req.body[key];
  if (req.body.headId !== undefined) {
    if (!mongoose.isObjectIdOrHexString(req.body.headId) || !(await User.exists({ _id: req.body.headId, role: "department_head", department: req.params.id }))) return res.status(400).json({ message: "Kafedra mudiri noto‘g‘ri" });
    update.head = req.body.headId;
  }
  const department = await Department.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate("head", "fullName phone");
  if (!department) return res.status(404).json({ message: "Kafedra topilmadi" });
  res.json(department);
});
router.delete("/departments/:id", async (req, res) => {
  if (await User.exists({ department: req.params.id })) return res.status(409).json({ message: "Kafedraga o‘qituvchilar biriktirilgan" });
  const department = await Department.findByIdAndDelete(req.params.id);
  if (!department) return res.status(404).json({ message: "Kafedra topilmadi" });
  res.json({ message: "Kafedra o‘chirildi" });
});

// ---------- GROUPS & SUBJECTS ----------
router.post(
  "/users/:id/test-notification",
  require("express-rate-limit").rateLimit({
    windowMs: 300000,
    limit: 3,
    keyGenerator: (req) => String(req.user._id),
    standardHeaders: true,
    legacyHeaders: false,
  }),
  async (req, res) => {
    const recipient = await User.findOne({
      _id: req.params.id,
      role: "teacher",
      approved: true,
    }).select("_id");
    if (!recipient)
      return res.status(404).json({ message: "Faol o‘qituvchi topilmadi" });
    const [notification] = await require("../notifications").notifyUsers(
      [recipient._id],
      {
        actor: req.user._id,
        kind: "push.test",
        title: "Sinov bildirishnomasi",
        body: "Assalomu alaykum! Bu OXU Digital tizimidan yuborilgan sinov xabari. Dars jadvali va davomat haqidagi bildirishnomalar shu yerda keladi.",
        urls: { teacher: "/teacher" },
      },
    );
    res
      .status(202)
      .json({
        id: notification._id,
        message: "Sinov xabari navbatga qo‘shildi",
      });
  },
);
router.get("/notification-deliveries/:id", async (req, res) => {
  const notification = await Notification.findById(req.params.id).select(
    "queued",
  );
  if (!notification)
    return res.status(404).json({ message: "Xabar topilmadi" });
  const jobs = await require("../models/NotificationDelivery")
    .find({ notification: notification._id })
    .select("channel state errorCode attempts -_id");
  res.json({ queued: notification.queued, jobs });
});

router.get("/groups", async (req, res) => {
  const groups = await Group.find().sort({ name: 1 });
  const withCount = await Promise.all(
    groups.map(async (g) => ({
      ...g.toObject(),
      studentCount: await User.countDocuments({
        group: g._id,
        role: "student",
      }),
    })),
  );
  res.json(withCount);
});

router.post("/groups", async (req, res) => {
  const course = req.body.course;
  if (course != null && (!Number.isInteger(course) || course < 1 || course > 6))
    return res
      .status(400)
      .json({ message: "Kurs 1 dan 6 gacha bo‘lishi kerak" });
  if (
    typeof req.body.name !== "string" ||
    req.body.name.trim().length < 2 ||
    req.body.name.length > 80
  )
    return res.status(400).json({ message: "Guruh nomini kiriting" });
  const year =
    req.body.admissionYear == null || req.body.admissionYear === ""
      ? null
      : Number(req.body.admissionYear);
  const semester =
    req.body.semester == null || req.body.semester === ""
      ? null
      : Number(req.body.semester);
  const capacity =
    req.body.capacity == null || req.body.capacity === ""
      ? 30
      : Number(req.body.capacity);
  if (year != null && (!Number.isInteger(year) || year < 2000 || year > 2100))
    return res.status(400).json({ message: "Qabul yili noto'g'ri" });
  if (
    semester != null &&
    (!Number.isInteger(semester) || semester < 1 || semester > 12)
  )
    return res.status(400).json({ message: "Semestr noto'g'ri" });
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200)
    return res
      .status(400)
      .json({ message: "Talaba limiti 1 dan 200 gacha bo'lishi kerak" });
  const group = await Group.create({
    name: req.body.name.trim(),
    course: course ?? null,
    faculty: req.body.faculty || "",
    department: req.body.department || "",
    direction: req.body.direction || "",
    directionSourceId: req.body.directionSourceId || "",
    educationType: req.body.educationType || "Kunduzgi",
    admissionYear: year,
    semester,
    capacity,
    active: req.body.active !== false,
  });
  await notifyAdmins({
    actor: req.user._id,
    kind: "group.created",
    title: "Guruh qo‘shildi",
    body: `${group.name} guruhi yaratildi.`,
    urls: { admin: "/admin/groups-subjects" },
  });
  res.status(201).json(group);
});

router.delete("/groups/:id", async (req, res) => {
  if (
    (await User.exists({ group: req.params.id })) ||
    (await Lesson.exists({ groups: req.params.id }))
  )
    return res
      .status(409)
      .json({ message: "Guruhga talabalar yoki darslar bog‘langan" });
  const group = await Group.findByIdAndDelete(req.params.id);
  if (!group) return res.status(404).json({ message: "Guruh topilmadi" });
  await notifyAdmins({
    actor: req.user._id,
    kind: "group.deleted",
    title: "Guruh o‘chirildi",
    body: `${group.name} guruhi o‘chirildi.`,
    urls: { admin: "/admin/groups-subjects" },
  });
  res.json({ message: "O‘chirildi" });
});

router.get("/subjects", async (req, res) => {
  res.json(await Subject.find().sort({ name: 1 }));
});

router.get("/academic-catalog", (req, res) =>
  res.json(require("../data/academic-catalog.json")),
);
router.post("/subjects", async (req, res) => {
  const { department = "", referenceSource = "" } = req.body;
  if (
    typeof department !== "string" ||
    department.length > 160 ||
    typeof referenceSource !== "string" ||
    referenceSource.length > 200
  )
    return res.status(400).json({ message: "Kafedra yoki manba noto‘g‘ri" });
  if (
    referenceSource &&
    ![
      "https://vacancy.oxu.uz/",
      "https://newapi.oxu.uz/api/uz/speciality",
      "https://oxu.uz/locales/uz/translation.json",
    ].includes(referenceSource)
  )
    return res
      .status(400)
      .json({ message: "Manba rasmiy katalogdan tanlansin" });
  const {
    name,
    code = "",
    direction = "",
    course = 1,
    semester = 1,
    block = "Tasdiqlanmagan",
    description = "",
    credits = 0,
    hours = {},
    deliveryHours = {},
    groupIds = [],
    syllabus,
  } = req.body;
  if (
    typeof code !== "string" ||
    code.length > 40 ||
    typeof direction !== "string" ||
    direction.length > 160 ||
    typeof description !== "string" ||
    description.length > 500 ||
    !Number.isInteger(course) ||
    course < 1 ||
    course > 6 ||
    !Number.isInteger(semester) ||
    semester < 1 ||
    semester > 12 ||
    !["Majburiy", "Tanlov", "Tasdiqlanmagan"].includes(block) ||
    typeof credits !== "number" ||
    !Number.isFinite(credits) ||
    credits < 0 ||
    credits > 60
  )
    return res.status(400).json({ message: "Fan maydonlari noto‘g‘ri" });
  if (
    !hours ||
    typeof hours !== "object" ||
    Array.isArray(hours) ||
    Object.entries(hours).some(
      ([key, values]) =>
        !["lecture", "practice", "lab", "experience", "independent"].includes(
          key,
        ) ||
        !Array.isArray(values) ||
        values.length !== 2 ||
        values.some((n) => !Number.isInteger(n) || n < 0 || n > 2000),
    )
  )
    return res
      .status(400)
      .json({ message: "Soatlar 0–2000 oralig‘ida butun son bo‘lsin" });
  if (
    !Array.isArray(groupIds) ||
    !groupIds.every(
      (id) => typeof id === "string" && mongoose.isObjectIdOrHexString(id),
    ) ||
    (await Group.countDocuments({ _id: { $in: groupIds } })) !==
      new Set(groupIds).size
  )
    return res.status(400).json({ message: "Guruhlarni to‘g‘ri tanlang" });
  if (
    syllabus &&
    (typeof syllabus.name !== "string" ||
      syllabus.name.length > 150 ||
      typeof syllabus.data !== "string" ||
      syllabus.data.length > 350000 ||
      !/^data:application\/pdf;base64,JVBERi0[A-Za-z0-9+/]*={0,2}$/.test(
        syllabus.data,
      ))
  )
    return res
      .status(400)
      .json({ message: "Sillabus PDF formatda, 250 KB gacha bo‘lsin" });
  const totalHours = Object.values(hours).reduce(
    (sum, values) => sum + values[0] + values[1],
    0,
  );
  if (credits > 0 && (totalHours < credits * 25 || totalHours > credits * 30))
    return res
      .status(400)
      .json({
        message: `Kredit uchun jami yuklama ${credits * 25}-${credits * 30} soat bo'lishi kerak`,
      });
  const subject = await Subject.create({
    name,
    code,
    direction,
    department,
    referenceSource,
    course,
    semester,
    block,
    description,
    credits,
    hours,
    deliveryHours,
    groups: [...new Set(groupIds)],
    syllabus,
  });
  await notifyAdmins({
    actor: req.user._id,
    kind: "subject.created",
    title: "Fan qo‘shildi",
    body: `${subject.name} fani yaratildi.`,
    urls: { admin: "/admin/groups-subjects" },
  });
  res.status(201).json(subject);
});

router.delete("/subjects/:id", async (req, res) => {
  if (await Lesson.exists({ subject: req.params.id }))
    return res.status(409).json({ message: "Fanga darslar bog‘langan" });
  const subject = await Subject.findByIdAndDelete(req.params.id);
  if (!subject) return res.status(404).json({ message: "Fan topilmadi" });
  await notifyAdmins({
    actor: req.user._id,
    kind: "subject.deleted",
    title: "Fan o‘chirildi",
    body: `${subject.name} fani o‘chirildi.`,
    urls: { admin: "/admin/groups-subjects" },
  });
  res.json({ message: "O‘chirildi" });
});

// ---------- LESSONS (schedule) ----------
router.get("/lessons", async (req, res) => {
  const dates = weekDates(
    req.query.weekStart || new Date().toISOString().slice(0, 10),
  );
  const filter = { date: { $in: dates } };
  if (req.query.teacherId) filter.teacher = req.query.teacherId;
  const lessons = await Lesson.find(filter)
    .populate("teacher", "fullName")
    .populate("subject", "name")
    .populate("groups", "name")
    .sort({ date: 1, startTime: 1 });
  res.json(lessons);
});

// Tanlangan sana uchun o'qituvchi va guruhlarning bo'sh para slotlari
router.get("/lesson-slots", async (req, res) => {
  const { date, teacherId } = req.query;
  const rawGroups = req.query.groupIds;
  const groupIds = Array.isArray(rawGroups)
    ? rawGroups
    : typeof rawGroups === "string" && rawGroups
      ? rawGroups.split(",")
      : [];
  if (
    !isValidDate(date) ||
    typeof teacherId !== "string" ||
    !mongoose.isObjectIdOrHexString(teacherId) ||
    groupIds.some(
      (id) => typeof id !== "string" || !mongoose.isObjectIdOrHexString(id),
    )
  ) {
    return res
      .status(400)
      .json({ message: "Sana, o‘qituvchi yoki guruh noto‘g‘ri" });
  }
  if (!isAssignableDate(date))
    return res
      .status(400)
      .json({ message: "Darsni kamida bir kun oldin biriktirish mumkin" });
  const lessons = await Lesson.find({
    date,
    $or: [{ teacher: teacherId }, { groups: { $in: groupIds } }],
  }).select("startTime endTime pairNumber");
  const free = PAIR_TIMES.filter(
    (slot) =>
      !lessons.some(
        (lesson) =>
          lesson.pairNumber === slot.pairNumber ||
          (lesson.startTime < slot.endTime && lesson.endTime > slot.startTime),
      ),
  );
  res.json({ date, slots: free });
});

// Sana + para uchun bo'sh o'qituvchilar va bo'sh guruhlar
const roomKeyOf = (building, room) =>
  JSON.stringify([
    building.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
    room.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
  ]);
router.get("/rooms", async (req, res) =>
  res.json(
    await require("../models/Room").find().sort({ building: 1, name: 1 }),
  ),
);
router.post("/rooms", async (req, res) => {
  const { building, name } = req.body;
  if (
    typeof building !== "string" ||
    typeof name !== "string" ||
    !building.trim() ||
    !name.trim()
  )
    return res.status(400).json({ message: "Bino va xona nomini kiriting" });
  res
    .status(201)
    .json(
      await require("../models/Room").create({
        building: building.trim(),
        name: name.trim(),
        key: roomKeyOf(building, name),
      }),
    );
});
router.get("/slot-options", async (req, res) => {
  const { date } = req.query;
  const pairNumber = Number(req.query.pairNumber);
  if (
    !isValidDate(date) ||
    !Number.isInteger(pairNumber) ||
    pairNumber < 1 ||
    pairNumber > PAIR_TIMES.length
  ) {
    return res.status(400).json({ message: "Sana yoki para noto‘g‘ri" });
  }
  if (!isAssignableDate(date))
    return res
      .status(400)
      .json({ message: "Darsni kamida bir kun oldin biriktirish mumkin" });
  const slot = PAIR_TIMES[pairNumber - 1];
  const busy = await Lesson.find({
    date,
    $or: [
      { pairNumber },
      { startTime: { $lt: slot.endTime }, endTime: { $gt: slot.startTime } },
    ],
  }).select(
    "teacher groups subject room building startTime endTime pairNumber",
  );
  const busyTeachers = new Set(busy.map((lesson) => lesson.teacher.toString()));
  const busyGroups = new Set(
    busy.flatMap((lesson) => lesson.groups.map((group) => group.toString())),
  );
  const [teachers, groups] = await Promise.all([
    User.find({ role: "teacher", approved: true })
      .select("fullName subjects")
      .populate("subjects", "name")
      .sort({ fullName: 1 }),
    Group.find().sort({ name: 1 }),
  ]);
  res.json({
    date,
    pairNumber,
    slot,
    rooms: (
      await require("../models/Room").find().sort({ building: 1, name: 1 })
    ).map((room) => ({
      ...room.toObject(),
      busy: busy.some(
        (lesson) =>
          roomKeyOf(lesson.building || "", lesson.room || "") === room.key,
      ),
    })),
    unassignedTeachers: teachers.filter(
      (teacher) =>
        !teacher.subjects.length && !busyTeachers.has(teacher._id.toString()),
    ),
    busyLessons: await Lesson.populate(busy, [
      { path: "teacher", select: "fullName" },
      { path: "subject", select: "name" },
      { path: "groups", select: "name" },
    ]),
    teachers: teachers.filter(
      (teacher) =>
        teacher.subjects.length && !busyTeachers.has(teacher._id.toString()),
    ),
    groups: groups.filter((group) => !busyGroups.has(group._id.toString())),
  });
});

router.post("/lessons", async (req, res) => {
  const {
    teacherId,
    subjectId,
    groupIds,
    date,
    startTime,
    endTime,
    pairNumber,
    room,
    building,
    type,
  } = req.body;
  const repeat = req.body.repeat !== false;
  if (
    !teacherId ||
    !subjectId ||
    !Array.isArray(groupIds) ||
    groupIds.length === 0 ||
    !date ||
    !startTime ||
    !endTime
  ) {
    return res.status(400).json({ message: "Barcha maydonlarni to‘ldiring" });
  }
  if (
    ![teacherId, subjectId, ...groupIds].every(
      (id) => typeof id === "string" && mongoose.isObjectIdOrHexString(id),
    )
  )
    return res
      .status(400)
      .json({ message: "O‘qituvchi, fan yoki guruh noto‘g‘ri" });
  if (
    !isValidDate(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
    endTime <= startTime ||
    !Number.isInteger(pairNumber) ||
    pairNumber < 1 ||
    pairNumber > 9
  )
    return res
      .status(400)
      .json({ message: "Sana, vaqt oralig‘i yoki para noto‘g‘ri" });
  if (!isAssignableDate(date))
    return res
      .status(400)
      .json({ message: "Darsni kamida bir kun oldin biriktirish mumkin" });
  const slot = PAIR_TIMES[pairNumber - 1];
  if (startTime !== slot.startTime || endTime !== slot.endTime)
    return res.status(400).json({ message: "Vaqt tanlangan paraga mos emas" });

  const lessonType = type || "Amaliyot";
  if (!LESSON_TYPES.includes(lessonType))
    return res.status(400).json({ message: "Dars turi noto‘g‘ri" });
  const uniqueGroups = [...new Set(groupIds)];
  const roomKey =
    room?.trim() && building?.trim() ? roomKeyOf(building, room) : undefined;
  const roomConflict = roomKey
    ? {
        room: {
          $regex:
            "^" + room.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
          $options: "i",
        },
        building: {
          $regex:
            "^" + building.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
          $options: "i",
        },
      }
    : null;
  // Ma'ruza — bir parada bir nechta guruhga; amaliyot/laboratoriya — faqat bitta guruhga
  if (lessonType !== "Ma'ruza" && uniqueGroups.length > 1) {
    return res
      .status(400)
      .json({
        message:
          "Amaliyot va laboratoriya darsida bir parada faqat bitta guruh bo‘ladi",
      });
  }

  const [teacher, subject, groupsCount] = await Promise.all([
    User.findOne({ _id: teacherId, role: "teacher", approved: true }).select(
      "subjects",
    ),
    Subject.exists({ _id: subjectId }),
    Group.countDocuments({ _id: { $in: uniqueGroups } }),
  ]);
  if (!teacher || !subject || groupsCount !== uniqueGroups.length)
    return res
      .status(400)
      .json({ message: "Tasdiqlangan o‘qituvchi, fan va guruhlarni tanlang" });
  if (!teacher.subjects?.some((id) => id.toString() === subjectId)) {
    return res
      .status(400)
      .json({
        message:
          "Bu fan o‘qituvchiga biriktirilmagan. Avval hisobga fan qo‘shing",
      });
  }

  const conflictFilter = (day) => ({
    date: day,
    $and: [
      {
        $or: [
          { teacher: teacherId },
          { groups: { $in: uniqueGroups } },
          ...(roomConflict ? [{ $or: [{ roomKey }, roomConflict] }] : []),
        ],
      },
      {
        $or: [
          { pairNumber },
          { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
        ],
      },
    ],
  });

  // Birinchi hafta albatta yozilishi shart, keyingi haftalarda band slotlar tashlab ketiladi
  if (await Lesson.exists(conflictFilter(date))) {
    return res
      .status(409)
      .json({
        message: "Bu vaqtda o‘qituvchi, guruh yoki tanlangan bino va xona band",
      });
  }

  const seriesId = new mongoose.Types.ObjectId();
  const tomorrow = addDaysKey(todayKey(), 1);
  const dates = repeat
    ? Array.from({ length: RECUR_WEEKS }, (_, i) => shiftDate(date, i * 7))
    : [date];
  const weekDatesToCreate = [];
  for (const day of dates) {
    if (day < tomorrow) continue;
    if (day !== date && (await Lesson.exists(conflictFilter(day)))) continue;
    weekDatesToCreate.push(day);
  }
  if (!weekDatesToCreate.length)
    return res
      .status(409)
      .json({
        message: "Bu vaqtda o‘qituvchi yoki guruhning boshqa darsi bor",
      });

  // Bir kunda o'qituvchi va har bir guruh paralarida bo'shliq qolmasin: 2-3-4 mumkin, 1-3 yoki 1-3-5 mumkin emas.
  for (const day of weekDatesToCreate) {
    const existing = await Lesson.find({
      date: day,
      $or: [{ teacher: teacherId }, { groups: { $in: uniqueGroups } }],
    }).select("pairNumber teacher groups");
    const entities = [
      {
        pairs: existing
          .filter((l) => l.teacher.toString() === teacherId)
          .map((l) => l.pairNumber),
      },
    ];
    for (const groupId of uniqueGroups)
      entities.push({
        pairs: existing
          .filter((l) => l.groups.some((g) => g.toString() === groupId))
          .map((l) => l.pairNumber),
      });
    for (const entity of entities) {
      const pairs = [...new Set([...entity.pairs, pairNumber])].sort(
        (a, b) => a - b,
      );
      if (pairs[pairs.length - 1] - pairs[0] + 1 !== pairs.length)
        return res
          .status(409)
          .json({
            message:
              "Paralar ketma-ket bo'lishi kerak. Orada bo'sh para qoldirib dars qo'shib bo'lmaydi.",
          });
    }
  }

  const lessons = await Lesson.insertMany(
    weekDatesToCreate.map((day) => ({
      teacher: teacherId,
      subject: subjectId,
      groups: uniqueGroups,
      date: day,
      startTime,
      endTime,
      pairNumber,
      room,
      ...(roomKey ? { roomKey } : {}),
      building,
      type: lessonType,
      seriesId,
    })),
  );

  await notifyLesson(
    lessons[0],
    req.user._id,
    false,
    lessons.length > 1 ? `Har hafta takrorlanadi: ${lessons.length} hafta` : "",
  );
  res
    .status(201)
    .json({
      ...lessons[0].toObject(),
      created: lessons.length,
      weeks: dates.length,
    });
});

router.delete("/lessons/:id", async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).json({ message: "Dars topilmadi" });
  const ids =
    req.query.series === "1" && lesson.seriesId
      ? (await Lesson.find({ seriesId: lesson.seriesId }).select("_id")).map(
          (item) => item._id,
        )
      : [lesson._id];
  await Lesson.deleteMany({ _id: { $in: ids } });
  await Attendance.deleteMany({ lesson: { $in: ids } });
  await notifyLesson(
    lesson,
    req.user._id,
    true,
    ids.length > 1 ? `${ids.length} ta hafta bekor qilindi` : "",
  );
  res.json({ message: "O‘chirildi", count: ids.length });
});

// Bandlik gridi: o'qituvchi x kun x para
router.get("/workload", async (req, res) => {
  const dates = weekDates(
    req.query.weekStart || new Date().toISOString().slice(0, 10),
  );
  const teachers = await User.find({ role: "teacher", approved: true })
    .select("fullName")
    .sort({ fullName: 1 });
  const lessons = await Lesson.find({ date: { $in: dates } }).select(
    "teacher date pairNumber",
  );
  const grid = teachers.map((t) => {
    const cells = {};
    lessons
      .filter((l) => l.teacher.toString() === t._id.toString())
      .forEach((l) => {
        cells[`${l.date}_${l.pairNumber}`] = true;
      });
    return { teacherId: t._id, fullName: t.fullName, cells };
  });
  res.json({ dates, grid });
});

module.exports = router;
