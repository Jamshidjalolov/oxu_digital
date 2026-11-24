require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Group = require('./models/Group');
const Subject = require('./models/Subject');
const Lesson = require('./models/Lesson');
const Attendance = require('./models/Attendance');

const groupsData = ['S4-ATT-24', 'S5-ATT-24', 'S6-ATT-24', 'KM2-ATT-25'];
const subjectsData = ['Kiberxavfsizlik asoslari', 'Kompyuter tarmoqlari', 'Elektronika va sxemalar'];

const teachersData = [
  { fullName: 'RAJABOV AZIZBEK RAVSHANBOYEVICH', phone: '901000001', role: 'teacher' },
  { fullName: 'ADIZOVA FATIMA MA’RUF QIZI', phone: '901000002', role: 'teacher' },
  { fullName: 'AMONOVA LOLA OLIM QIZI', phone: '901000003', role: 'teacher' },
  { fullName: 'ASHUROV JASUR DJO’RAYEVICH', phone: '901000004', role: 'teacher' },
];

const studentsData = [
  ['AMONOV FARXOD G’OLIBOVICH', 0], ['ANVAROV ABDURAXMON MUZAFFAROVICH', 0],
  ['BAXRONOV SHERZOD ASKAROVICH', 0], ['BOLTAYEVA SHAHNOZA SHUKUROVNA', 0],
  ['DILMURODOVA DILNOZA ANVAROVNA', 0], ['ERGASHEV JASURBEK OTKIROVICH', 0],
  ['IBROHIMOV ABROR XALILOVICH', 0], ['KARIMOV SARVAR BEKZODOVICH', 0],
  ['MIRZOEV JASUR ANVAROVICH', 0], ['NORMURODOV BEGZOD IKROMOVICH', 0],
  ['QODIROVA MADINA RUSTAMOVNA', 0], ['RUSTAMOV DILSHOD BAXTIYOROVICH', 0],
  ['SATTOROVA GULNORA QODIROVNA', 0], ['TOSHEV AZAMAT RUSTAMOVICH', 0],
  ['USMONOV JASURBEK ALISHEROVICH', 0], ['YULDASHEVA ZILOLA XABIBULLOEVNA', 0],
  ['ABDULLAYEV SHOHJAHON OYBEKOVICH', 0], ['XOLMIRZAYEVA MUNIRA QODIROVNA', 0],
  ['AZIMOV JASURBEK MIRZOEVICH', 1], ['BOBOMURODOVA SHAHNOZA ABDULLAEVNA', 1],
  ['G’ANIYEVA MALIKA RUSTAMOVNA', 1], ['HOSHIMOV BEGZOD ANVAROVICH', 1],
  ['ISMOILOV SARVAR XOLMIRZAYEVICH', 1], ['JALILOV ABROR BEKZODOVICH', 1],
  ['KAMALOVA MADINA ANVAROVNA', 1], ['LUTFULLAYEV JASUR OTKIROVICH', 1],
  ['MAMADJONOV DILSHOD QODIROVICH', 1], ['NABIYEVA ZILOLA XABIBOVNA', 1],
  ['OTABEKOV SHOHJAHON RUSTAMOVICH', 1], ['PARPIYEV ABDURAXMON MIRZOEVICH', 1],
  ['QURBONOV AZAMAT ALISHEROVICH', 1], ['RAXIMOVA GULNORA BAXTIYOROVNA', 1],
  ['SAIDOV BEGZOD IKROMOVICH', 1], ['TURG’UNOV JASURBEK QODIROVICH', 1],
  ['UMAROV SHOHJAHON OYBEKOVICH', 1], ['VAPOEV MUNIRA QODIROVNA', 1],
  ['XOLMATOV ABROR ANVAROVICH', 2], ['YAKUBOV SARVAR BEKZODOVICH', 2],
  ['ZOKIROVA MADINA RUSTAMOVNA', 2], ['ABDURAXMONOV JASUR ANVAROVICH', 2],
  ['BEKMURODOV DILSHOD BAXTIYOROVICH', 2], ['CHORIYEVA GULNORA QODIROVNA', 2],
  ['DAVRONOV AZAMAT RUSTAMOVICH', 2], ['ERKINOV JASURBEK ALISHEROVICH', 2],
  ['FAYZULLAYEVA ZILOLA XABIBULLOEVNA', 2], ['GULOMOV SHOHJAHON OYBEKOVICH', 2],
  ['HUSANOV MUNIRA QODIROVNA', 2], ['IBROHIMOV ABROR XALILOVICH', 2],
  ['JO’RAYEV JASURBEK MIRZOEVICH', 2], ['KARIMJONOV BEGZOD ANVAROVICH', 2],
  ['MIRZAYEV SARVAR XOLMIRZAYEVICH', 2], ['NURMATOV DILSHOD QODIROVICH', 2],
  ['RASULOVA MADINA ANVAROVNA', 2], ['SODIQOV ABROR BEKZODOVICH', 2],
  ['TOSHTEMIROV JASUR OTKIROVICH', 2], ['XALILOV AZAMAT ALISHEROVICH', 2],
  ['YUSSUPOVA GULNORA BAXTIYOROVNA', 2], ['ZAYNIDDINOV SHOHJAHON RUSTAMOVICH', 3],
  ['AHMEDOV BEGZOD IKROMOVICH', 3], ['BOTIROVA ZILOLA XABIBOVNA', 3],
  ['DONIYOROV NEGMUROD NORMURODOVICH', 3], ['ESONOV JASURBEK QODIROVICH', 3],
  ['FATXULLAYEV MUNIRA QODIROVNA', 3], ['G’AFUROV ABROR ANVAROVICH', 3],
  ['HASANOV SARVAR BEKZODOVICH', 3], ['ISLOMOV MADINA RUSTAMOVNA', 3],
  ['JUMANAZAROV DILSHOD BAXTIYOROVICH', 3], ['KOMILOV AZAMAT RUSTAMOVICH', 3],
  ['MUXTOROV JASURBEK ALISHEROVICH', 3], ['NORBOYEVA ZILOLA XABIBULLOEVNA', 3],
  ['OLIMOV SHOHJAHON OYBEKOVICH', 3], ['POLVONOV MUNIRA QODIROVNA', 3],
  ['QOSIMOV ABROR XALILOVICH', 3], ['ROZIQOV JASUR ANVAROVICH', 3],
];

// 2026-11-09 (dushanba) haftasi
const lessonsData = [
  // Rajabov Azizbek
  { teacher: 0, subject: 2, groups: [0, 1, 2], date: '2026-11-09', startTime: '12:50', endTime: '14:10', pair: 4, room: '404', building: "4-o'quv bino", type: "Ma'ruza" },
  { teacher: 0, subject: 0, groups: [1], date: '2026-11-09', startTime: '15:50', endTime: '17:10', pair: 6, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 0, groups: [0], date: '2026-11-10', startTime: '12:50', endTime: '14:10', pair: 4, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 1, groups: [0, 1, 2], date: '2026-11-10', startTime: '14:20', endTime: '15:40', pair: 5, room: 'KM2', building: "4-o'quv bino", type: "Ma'ruza" },
  { teacher: 0, subject: 0, groups: [1], date: '2026-11-10', startTime: '15:50', endTime: '17:10', pair: 6, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 0, groups: [2], date: '2026-11-11', startTime: '12:50', endTime: '14:10', pair: 4, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 1, groups: [3], date: '2026-11-11', startTime: '14:20', endTime: '15:40', pair: 5, room: 'KM2', building: "4-o'quv bino", type: "Ma'ruza" },
  { teacher: 0, subject: 0, groups: [0], date: '2026-11-11', startTime: '15:50', endTime: '17:10', pair: 6, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 0, groups: [2], date: '2026-11-12', startTime: '12:50', endTime: '14:10', pair: 4, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 2, groups: [0, 1, 2], date: '2026-11-12', startTime: '15:50', endTime: '17:10', pair: 6, room: '404', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 0, groups: [1], date: '2026-11-13', startTime: '12:50', endTime: '14:10', pair: 4, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 1, groups: [3], date: '2026-11-13', startTime: '14:20', endTime: '15:40', pair: 5, room: 'KM2', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 0, groups: [3], date: '2026-11-14', startTime: '12:50', endTime: '14:10', pair: 4, room: '306', building: "4-o'quv bino", type: 'Amaliyot' },
  { teacher: 0, subject: 2, groups: [0, 1, 2], date: '2026-11-14', startTime: '15:50', endTime: '17:10', pair: 6, room: '404', building: "4-o'quv bino", type: 'Amaliyot' },
  // Adizova Fotima
  { teacher: 1, subject: 1, groups: [0, 1], date: '2026-11-09', startTime: '08:30', endTime: '09:50', pair: 1, room: '205', building: "1-o'quv bino", type: "Ma'ruza" },
  { teacher: 1, subject: 1, groups: [0], date: '2026-11-10', startTime: '10:00', endTime: '11:20', pair: 2, room: '207', building: "1-o'quv bino", type: 'Amaliyot' },
  { teacher: 1, subject: 0, groups: [2], date: '2026-11-11', startTime: '08:30', endTime: '09:50', pair: 1, room: '301', building: "1-o'quv bino", type: "Ma'ruza" },
  { teacher: 1, subject: 1, groups: [1], date: '2026-11-12', startTime: '10:00', endTime: '11:20', pair: 2, room: '207', building: "1-o'quv bino", type: 'Amaliyot' },
  { teacher: 1, subject: 0, groups: [2, 3], date: '2026-11-13', startTime: '08:30', endTime: '09:50', pair: 1, room: '301', building: "1-o'quv bino", type: 'Amaliyot' },
  { teacher: 1, subject: 1, groups: [0, 1], date: '2026-11-14', startTime: '08:30', endTime: '09:50', pair: 1, room: '205', building: "1-o'quv bino", type: 'Amaliyot' },
  // Amonova Lola
  { teacher: 2, subject: 2, groups: [3], date: '2026-11-09', startTime: '10:00', endTime: '11:20', pair: 2, room: '402', building: "2-o'quv bino", type: 'Amaliyot' },
  { teacher: 2, subject: 0, groups: [0, 1], date: '2026-11-10', startTime: '08:30', endTime: '09:50', pair: 1, room: '302', building: "2-o'quv bino", type: "Ma'ruza" },
  { teacher: 2, subject: 2, groups: [2, 3], date: '2026-11-11', startTime: '10:00', endTime: '11:20', pair: 2, room: '402', building: "2-o'quv bino", type: "Ma'ruza" },
  { teacher: 2, subject: 0, groups: [0, 1], date: '2026-11-12', startTime: '08:30', endTime: '09:50', pair: 1, room: '302', building: "2-o'quv bino", type: 'Amaliyot' },
  { teacher: 2, subject: 2, groups: [2, 3], date: '2026-11-14', startTime: '10:00', endTime: '11:20', pair: 2, room: '402', building: "2-o'quv bino", type: 'Amaliyot' },
  // Ashurov Jasur
  { teacher: 3, subject: 1, groups: [2], date: '2026-11-09', startTime: '14:20', endTime: '15:40', pair: 5, room: 'KM1', building: "3-o'quv bino", type: 'Amaliyot' },
  { teacher: 3, subject: 0, groups: [3], date: '2026-11-10', startTime: '14:20', endTime: '15:40', pair: 5, room: '303', building: "3-o'quv bino", type: "Ma'ruza" },
  { teacher: 3, subject: 1, groups: [0, 2], date: '2026-11-12', startTime: '14:20', endTime: '15:40', pair: 5, room: 'KM1', building: "3-o'quv bino", type: "Ma'ruza" },
  { teacher: 3, subject: 0, groups: [3], date: '2026-11-13', startTime: '14:20', endTime: '15:40', pair: 5, room: '303', building: "3-o'quv bino", type: 'Amaliyot' },
  { teacher: 3, subject: 1, groups: [1, 3], date: '2026-11-14', startTime: '14:20', endTime: '15:40', pair: 5, room: 'KM1', building: "3-o'quv bino", type: 'Amaliyot' },
];

async function seedData() {
  await Promise.all([
    User.deleteMany({}), Group.deleteMany({}), Subject.deleteMany({}),
    Lesson.deleteMany({}), Attendance.deleteMany({}),
  ]);

  const hash = await bcrypt.hash('123456', 10);

  await User.create({
    fullName: 'Admin', phone: '900000000', password: hash, role: 'admin', approved: true,
  });

  const groups = await Group.insertMany(groupsData.map((name) => ({ name })));
  const subjects = await Subject.insertMany(subjectsData.map((name) => ({ name })));

  const teachers = [];
  for (const t of teachersData) {
    const assigned = [...new Set(lessonsData.filter((lesson) => lesson.teacher === teachers.length).map((lesson) => lesson.subject))];
    teachers.push(await User.create({ ...t, subjects: assigned.map((index) => subjects[index]._id), password: hash, approved: true }));
  }

  let s = 0;
  for (const [fullName, gi] of studentsData) {
    s += 1;
    await User.create({
      fullName, phone: '93' + String(1000000 + s), password: hash,
      role: 'student', group: groups[gi]._id, approved: true,
    });
  }
  console.log(`${teachers.length} o'qituvchi, ${s} talaba yaratildi`);

  const students = await User.find({ role: 'student' });
  for (const ld of lessonsData) {
    const lesson = await Lesson.create({
      teacher: teachers[ld.teacher]._id,
      subject: subjects[ld.subject]._id,
      groups: ld.groups.map((i) => groups[i]._id),
      date: ld.date, startTime: ld.startTime, endTime: ld.endTime,
      pairNumber: ld.pair, room: ld.room, building: ld.building, type: ld.type,
    });
    // O'tgan kunlarga (11-09, 11-10) davomat qo'shamiz
    if (ld.date <= '2026-11-10') {
      const groupIds = ld.groups.map((i) => groups[i]._id.toString());
      const inGroups = students.filter((st) => groupIds.includes(st.group.toString()));
      const records = inGroups.map((st) => ({
        lesson: lesson._id, student: st._id, markedBy: teachers[ld.teacher]._id,
        status: Math.random() > 0.15 ? 'present' : 'absent',
      }));
      if (records.length) await Attendance.insertMany(records);
    }
  }
  console.log(`${lessonsData.length} dars yaratildi, o'tgan kunlarga davomat qo'shildi`);
  console.log('Seed yakunlandi. Login: admin / 900000000 / 123456');
}

module.exports = seedData;

if (require.main === module) {
  const connectDB = require('./db');
  connectDB()
    .then(async () => {
      await seedData();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((e) => { console.error(e); process.exit(1); });
}
