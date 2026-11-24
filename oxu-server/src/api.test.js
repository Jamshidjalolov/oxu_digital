const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = randomBytes(32).toString('hex');
const webPush = { ...require('web-push') };
require.cache[require.resolve('web-push')].exports = webPush;
const app = require('./index');
const User = require('./models/User');
const Group = require('./models/Group');
const Subject = require('./models/Subject');
const Lesson = require('./models/Lesson');
const Attendance = require('./models/Attendance');
const Notification = require('./models/Notification');
const Subscription = require('./models/PushSubscription');
const Delivery = require('./models/NotificationDelivery');
const notifications = require('./notifications');
process.env.BOT_LINK_SECRET = randomBytes(32).toString('hex');
process.env.TELEGRAM_BOT_TOKEN = 'test-token-never-sent';
const vapid = webPush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

let mongo, server, base, group, otherGroup, subject, teacher, otherTeacher, student, otherStudent;
let adminToken, teacherToken, studentToken, lessonId;

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return keyOf(new Date(y, m - 1, d + n));
};
const mondayOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return addDays(key, day === 0 ? -6 : 1 - day);
};
const today = keyOf(new Date());
const pastDay = addDays(today, -1);
const weekStart = mondayOf(addDays(today, 14));
const day1 = weekStart;
const day2 = addDays(weekStart, 1);
const call = async (method, path, body, token, headers = {}) => {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
};
const login = async (phone) => (await call('POST', '/auth/login', { phone, password: '123456' })).data.token;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('oxu_test'));
  group = await Group.create({ name: 'TEST-01' });
  otherGroup = await Group.create({ name: 'TEST-02' });
  subject = await Subject.create({ name: 'Test fan' });
  const password = await bcrypt.hash('123456', 10);
  await User.create({ fullName: 'Test Admin', phone: '900000000', password, role: 'admin', approved: true });
  teacher = await User.create({ fullName: 'Test Teacher', phone: '901000001', password, role: 'teacher', subjects: [subject._id], approved: true });
  otherTeacher = await User.create({ fullName: 'Other Teacher', phone: '901000002', password, role: 'teacher', subjects: [subject._id], approved: true });
  student = await User.create({ fullName: 'Test Student', phone: '931000001', password, role: 'student', group: group._id, approved: true });
  otherStudent = await User.create({ fullName: 'Other Student', phone: '931000002', password, role: 'student', group: otherGroup._id, approved: true });
  server = app.listen(0);
  require('./realtime').attach(server);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  adminToken = await login('900000000'); teacherToken = await login('901000001'); studentToken = await login('931000001');
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('lessons require a subject assigned to the teacher', async () => {
  const body = { teacherId: teacher._id.toString(), subjectId: subject._id.toString(), groupIds: [group._id.toString()], date: day1, startTime: '08:30', endTime: '09:50', pairNumber: 1, type: 'Amaliyot', repeat: false };
  const unassigned = await Subject.create({ name: 'Unassigned subject' });
  assert.equal((await call('POST', '/admin/lessons', { ...body, subjectId: unassigned._id.toString() }, adminToken)).status, 400);
  await User.updateOne({ _id: teacher._id }, { subjects: [] });
  try {
    assert.equal((await call('POST', '/admin/lessons', body, adminToken)).status, 400);
    const options = await call('GET', `/admin/slot-options?date=${day1}&pairNumber=1`, null, adminToken);
    assert.equal(options.data.teachers.some(t => String(t._id) === String(teacher._id)), false);
  } finally {
    await User.updateOne({ _id: teacher._id }, { subjects: [subject._id] });
    await Subject.deleteOne({ _id: unassigned._id });
  }
});

test('deleting linked accounts cleans their data and preserves other accounts', async () => {
  const disposable = await User.create({ fullName: 'Delete teacher', phone: '909888777', password: 'unused', role: 'teacher', subjects: [subject._id] });
  const pupil = await User.create({ fullName: 'Delete student', phone: '909888778', password: 'unused', role: 'student', group: group._id });
  const lesson = await Lesson.create({ teacher: disposable._id, subject: subject._id, groups: [group._id], date: day1, startTime: '08:30', endTime: '09:50' });
  await Attendance.create({ lesson: lesson._id, student: pupil._id, markedBy: disposable._id, status: 'present' });
  assert.equal((await call('DELETE', `/admin/users/${pupil._id}`, null, adminToken)).status, 200);
  assert.equal(await Attendance.countDocuments({ student: pupil._id }), 0);
  assert.ok(await Lesson.exists({ _id: lesson._id }));
  await Attendance.create({ lesson: lesson._id, student: student._id, markedBy: disposable._id, status: 'present' });
  assert.equal((await call('DELETE', `/admin/users/${disposable._id}`, null, adminToken)).status, 200);
  assert.equal(await Lesson.countDocuments({ _id: lesson._id }), 0);
  assert.equal(await Attendance.countDocuments({ lesson: lesson._id }), 0);
  assert.ok(await User.exists({ _id: student._id }));
});

test('room conflicts are rejected across different teachers and groups', async () => {
  const room = await call('POST', '/admin/rooms', { building: 'Test building', name: '101' }, adminToken);
  assert.equal(room.status, 201);
  const existing = await Lesson.create({ teacher: teacher._id, subject: subject._id, groups: [group._id], date: day1, startTime: '08:30', endTime: '09:50', pairNumber: 1, building: 'Test building', room: '101' });
  try {
    const options = await call('GET', `/admin/slot-options?date=${day1}&pairNumber=1`, null, adminToken);
    assert.equal(options.data.rooms.find(r => r._id === room.data._id).busy, true);
    const body = { teacherId: otherTeacher._id.toString(), subjectId: subject._id.toString(), groupIds: [otherGroup._id.toString()], date: day1, startTime: '08:30', endTime: '09:50', pairNumber: 1, building: 'test building', room: '101', repeat: false };
    assert.equal((await call('POST', '/admin/lessons', body, adminToken)).status, 409);
    const created = await call('POST', '/admin/lessons', { ...body, building: 'Other building' }, adminToken);
    assert.equal(created.status, 201);
    await Lesson.deleteOne({ _id: created.data._id });
  } finally {
    await Lesson.deleteOne({ _id: existing._id });
    await require('./models/Room').deleteOne({ _id: room.data._id });
  }
});

test('self profile edits preserve permissions and protect phone changes', async () => {
  assert.equal((await call('PUT','/auth/me',{ fullName: 'Unauthorized' })).status,401);
  const original = await User.findById(teacher._id).lean();
  try {
    const edited = await call('PUT','/auth/me',{ fullName:'Edited teacher' },teacherToken);
    assert.equal(edited.status,200); assert.equal(edited.data.user.fullName,'Edited teacher');
    assert.equal((await call('PUT','/auth/me',{ role:'admin' },teacherToken)).status,400);
    assert.equal((await call('PUT','/auth/me',{ phone:'501234567' },teacherToken)).status,400);
    assert.equal((await call('PUT','/auth/me',{ phone:student.phone,currentPassword:'123456' },teacherToken)).status,409);
    assert.equal((await call('PUT','/auth/me',{ avatar:'data:image/svg+xml;base64,abc' },teacherToken)).status,400);
    const changed=await call('PUT','/auth/me',{phone:'+998 50 123 45 67',currentPassword:'123456'},teacherToken);
    assert.equal(changed.status,200); assert.equal(changed.data.user.phone,'501234567');
    assert.equal(changed.data.user.role,'teacher'); assert.equal(changed.data.user.password,undefined);
    assert.equal((await call('POST','/auth/login',{phone:'501234567',password:'123456'})).status,200);
  } finally { await User.updateOne({_id:teacher._id},{fullName:original.fullName,phone:original.phone,avatar:original.avatar||''}); }
});

test('WebSocket rejects invalid tokens and isolates refresh events', async () => {
  const { WebSocket } = require('ws');
  const url=base.replace(/^http/,'ws').replace(/\/api$/,'/api/realtime');
  const open=token=>new Promise((resolve,reject)=>{const ws=new WebSocket(url);ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'auth',token})));ws.once('message',raw=>resolve({ws,message:JSON.parse(raw.toString())}));ws.once('close',code=>{if(code===1008)resolve({code});});});
  assert.equal((await open('invalid')).code,1008);
  const a=await open(teacherToken),b=await open(studentToken);
  try {
    assert.equal(a.message.type,'ready');assert.equal(b.message.type,'ready');
    let foreign=false;b.ws.on('message',()=>{foreign=true;});
    const received=new Promise(resolve=>a.ws.once('message',raw=>resolve(JSON.parse(raw.toString()))));
    require('./realtime').publish([teacher._id]);
    assert.deepEqual(await received,{type:'refresh'});
    await new Promise(resolve=>setTimeout(resolve,60));assert.equal(foreign,false);
    const closed=new Promise(resolve=>a.ws.once('close',resolve));a.ws.send(JSON.stringify({type:'subscribe',userId:String(student._id)}));assert.equal(await closed,1008);
  } finally {a.ws.terminate();b.ws.terminate();}
});

test('push test requires authentication and targets only the current user', async () => {
  assert.equal((await call('POST','/notifications/test',{})).status,401);
  assert.equal((await call('POST','/notifications/test',{},teacherToken)).status,409);
  const sub=await Subscription.create({user:teacher._id,type:'expo',endpoint:'ExpoPushToken[test-only-destination]'});
  try {
    assert.equal((await call('POST','/notifications/test',{userId:String(student._id)},teacherToken)).status,202);
    const items=await Notification.find({kind:'push.test'});
    assert.ok(items.length>0);assert.ok(items.every(n=>String(n.user)===String(teacher._id)));
  } finally {await Subscription.deleteOne({_id:sub._id});await Notification.deleteMany({kind:'push.test'});}
});

test('admin teacher notification test is restricted and status is readable', async () => {
  const path=`/admin/users/${teacher._id}/test-notification`;
  assert.equal((await call('POST',path,{},studentToken)).status,403);
  const result=await call('POST',path,{},adminToken);
  assert.equal(result.status,202);
  const note=await Notification.findById(result.data.id);
  assert.equal(String(note.user),String(teacher._id));
  assert.equal((await call('GET',`/admin/notification-deliveries/${note._id}`,null,adminToken)).status,200);
  assert.equal((await call('GET',`/admin/notification-deliveries/${note._id}`,null,teacherToken)).status,403);
});

test('detailed subject validates and stores curriculum and group assignment', async () => {
  const body={name:'Curriculum test',code:'TEST1204',direction:'Test direction',course:2,semester:3,credits:4,hours:{lecture:[16,0],practice:[30,0],independent:[74,0]},groupIds:[String(group._id)]};
  assert.equal((await call('POST','/admin/subjects',{...body,hours:{lecture:[-1,0]}},adminToken)).status,400);
  assert.equal((await call('POST','/admin/subjects',{...body,groupIds:['invalid']},adminToken)).status,400);
  const result=await call('POST','/admin/subjects',body,adminToken);assert.equal(result.status,201);
  try {assert.equal(result.data.code,body.code);assert.equal(result.data.course,2);assert.deepEqual(result.data.hours.lecture,[16,0]);assert.equal(String(result.data.groups[0]),String(group._id));}finally{await Subject.deleteOne({_id:result.data._id});}
});

test('official academic catalog is admin-only and preserves provenance', async () => {
  assert.equal((await call('GET','/admin/academic-catalog',null,studentToken)).status,403);
  const result=await call('GET','/admin/academic-catalog',null,adminToken);
  assert.equal(result.status,200);assert.equal(result.data.directions.length,53);
  assert.ok(result.data.departments.length>=8);
  assert.ok(result.data.directions.every(d=>d.source.startsWith('https://newapi.oxu.uz/')));
  assert.ok(result.data.subjects.every(s=>s.code===undefined&&s.block===undefined));
  const created=await call('POST','/admin/subjects',{name:'Unverified catalog test',department:'Umumiy fanlar',referenceSource:'https://vacancy.oxu.uz/'},adminToken);
  assert.equal(created.status,201);assert.equal(created.data.block,'Tasdiqlanmagan');
  await Subject.deleteOne({_id:created.data._id});
});

test('public health and groups work without authentication', async () => {
  assert.equal((await call('GET', '/health')).status, 200);
  assert.equal((await call('GET', '/groups')).data.length, 2);
});

test('login normalization and role guards', async () => {
  assert.equal((await call('POST', '/auth/login', { phone: '+998 90 100 00 01', password: '123456' })).data.user.role, 'teacher');
  assert.equal((await call('GET', '/admin/users', null, studentToken)).status, 403);
  assert.equal((await call('GET', '/student/attendance', null, teacherToken)).status, 403);
  assert.equal((await call('GET', '/auth/me', null, adminToken)).data.user.role, 'admin');
});

test('public registration is unavailable and cannot create accounts', async () => {
  const count = await User.countDocuments();
  for (const role of ['student', 'teacher', 'admin']) {
    const body = { fullName: 'Public Account', phone: '901111111', password: '123456', role, groupId: group._id.toString() };
    assert.equal((await call('POST', '/auth/register', body)).status, 404);
    assert.equal((await call('POST', '/auth/register', body, adminToken)).status, 404);
  }
  assert.equal(await User.countDocuments(), count);
});

test('only administrators can create working student, teacher and admin accounts', async () => {
  const body = { fullName: 'Admin Created', phone: '901111111', password: '123456', role: 'teacher' };
  assert.equal((await call('POST', '/admin/users', body)).status, 401);
  assert.equal((await call('POST', '/admin/users', body, teacherToken)).status, 403);
  assert.equal((await call('POST', '/admin/users', body, studentToken)).status, 403);
  for (const [i, role] of ['student', 'teacher', 'admin'].entries()) {
    const phone = `90111111${i}`;
    const result = await call('POST', '/admin/users', { ...body, phone, role, ...(role === 'student' ? { groupId: otherGroup._id.toString() } : {}), ...(role === 'teacher' ? { subjectIds: [subject._id.toString()] } : {}) }, adminToken);
    assert.equal(result.status, 201);
    assert.equal(result.data.approved, true);
    assert.equal(result.data.password, undefined);
    const account = await call('POST', '/auth/login', { phone, password: '123456' });
    assert.equal(account.status, 200);
    assert.equal(account.data.user.role, role);
    if (role === 'student') assert.equal(account.data.user.group.id || account.data.user.group._id, otherGroup._id.toString());
  }
});

test('administrator-created accounts respect approval and do not expose passwords', async () => {
  const result = await call('POST', '/admin/users', { fullName: 'Pending Account', phone: '901333333', password: '123456', role: 'teacher', subjectIds: [subject._id.toString()], approved: false }, adminToken);
  assert.equal(result.status, 201);
  assert.equal(result.data.approved, false);
  assert.equal(result.data.password, undefined);
  assert.equal((await call('POST', '/auth/login', { phone: '901333333', password: '123456' })).status, 403);
  assert.equal((await call('PUT', `/admin/users/${result.data._id}`, { approved: 'false' }, adminToken)).status, 400);
});

test('invalid credentials and invalid administrator-created accounts are rejected', async () => {
  assert.equal((await call('POST', '/auth/login', { phone: { $ne: null }, password: '123456' })).status, 400);
  const body = { fullName: 'Invalid Account', phone: '901222222', password: '123456', role: 'teacher' };
  assert.equal((await call('POST', '/admin/users', { ...body, phone: { $ne: null } }, adminToken)).status, 400);
  assert.equal((await call('POST', '/admin/users', { ...body, password: '1' }, adminToken)).status, 400);
  assert.equal((await call('POST', '/admin/users', { ...body, role: 'invalid' }, adminToken)).status, 400);
  assert.equal((await call('POST', '/admin/users', { ...body, role: 'student' }, adminToken)).status, 400);
  assert.equal((await call('POST', '/admin/users', { ...body, phone: '900000000' }, adminToken)).status, 409);
});

test('only admins can reset passwords without leaking credentials or changing unrelated data', async () => {
  const accountIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const existingNotifications = await Notification.distinct('_id');
  // Include admin copies of events, not just notifications addressed to the test accounts.
  const testNotifications = { _id: { $nin: existingNotifications } };
  const unrelated = await User.findById(otherStudent._id).lean();
  const oldPassword = '123456';
  const secrets = [oldPassword, unrelated.password];
  const responses = [];
  const profile = (user) => ({ fullName: user.fullName, phone: user.phone, role: user.role, group: user.group ? String(user.group._id || user.group) : null, approved: user.approved });
  const assertPrivate = (value) => {
    const json = JSON.stringify(value);
    assert.doesNotMatch(json, /"(?:password|passwordHash|hash)"\s*:/i);
    assert.doesNotMatch(json, /\$2[aby]\$\d{2}\$/);
    for (const secret of secrets) assert.equal(json.includes(secret), false, 'Credentials must not be exposed');
  };

  try {
    const accounts = [];
    for (const [i, role] of ['teacher', 'student'].entries()) {
      const account = await User.create({ _id: accountIds[i], fullName: `Password Test ${role}`, phone: `90144444${i}`, password: await bcrypt.hash(oldPassword, 10), role, group: role === 'student' ? otherGroup._id : null, approved: true });
      const token = await login(account.phone);
      assert.equal(typeof token, 'string');
      accounts.push({ account, token });
      secrets.push(account.password);
    }

    for (const { account } of accounts) {
      const path = `/admin/users/${account._id}`;
      const before = await User.findById(account._id).lean();
      // A multibyte password at the bcrypt byte limit is valid, not just ASCII.
      const newPassword = account.role === 'teacher' ? 'é'.repeat(36) : 'reset-student-password';
      secrets.push(newPassword);
      for (const [token, status] of [[null, 401], ...accounts.map((item) => [item.token, 403])]) {
        const denied = await call('PUT', path, { password: newPassword }, token);
        assert.equal(denied.status, status);
        responses.push(denied.data);
        assert.deepEqual(await User.findById(account._id).lean(), before);
      }
      const invalidPasswords = ['', 'short', 'a'.repeat(73), 'é'.repeat(37), 123456, null, { value: oldPassword }, [oldPassword]];
      const notificationCount = await Notification.countDocuments();
      for (const password of invalidPasswords) {
        const invalid = await call('PUT', path, { password }, adminToken);
        assert.equal(invalid.status, 400, `Invalid password: ${JSON.stringify(password)}`);
        responses.push(invalid.data);
        assert.deepEqual(await User.findById(account._id).lean(), before, 'Rejected updates must preserve the hash and profile');
      }
      assert.equal(await Notification.countDocuments(), notificationCount);

      const reset = await call('PUT', path, { password: newPassword }, adminToken);
      assert.equal(reset.status, 200);
      const updated = await User.findById(account._id).lean();
      assert.notEqual(updated.password, before.password);
      assert.notEqual(updated.password, newPassword);
      assert.match(updated.password, /^\$2[aby]\$\d{2}\$/);
      assert.equal(await bcrypt.compare(newPassword, updated.password), true);
      assert.equal(await bcrypt.compare(oldPassword, updated.password), false);
      assert.deepEqual(profile(updated), profile(before));
      assert.deepEqual(profile(reset.data), profile(before));
      secrets.push(updated.password);
      responses.push(reset.data);

      const oldLogin = await call('POST', '/auth/login', { phone: account.phone, password: oldPassword });
      assert.equal(oldLogin.status, 401);
      const newLogin = await call('POST', '/auth/login', { phone: account.phone, password: newPassword });
      assert.equal(newLogin.status, 200);
      assert.equal(newLogin.data.user.id, String(account._id));
      assert.deepEqual(profile(newLogin.data.user), profile(before));
      assert.equal(typeof newLogin.data.token, 'string');
      const me = await call('GET', '/auth/me', null, newLogin.data.token);
      assert.equal(me.status, 200);
      assert.equal(me.data.user.id, String(account._id));
      assert.deepEqual(profile(me.data.user), profile(before));
      responses.push(oldLogin.data, newLogin.data, me.data);

      const fullName = `${account.fullName} Edited`;
      const edited = await call('PUT', path, { fullName }, adminToken);
      assert.equal(edited.status, 200);
      const afterEdit = await User.findById(account._id).lean();
      assert.equal(afterEdit.password, updated.password, 'Omitting password must preserve the exact hash');
      assert.deepEqual(profile(afterEdit), { ...profile(before), fullName });
      assert.deepEqual(profile(edited.data), profile(afterEdit));
      responses.push(edited.data);
    }

    const users = await call('GET', '/admin/users', null, adminToken);
    assert.equal(users.status, 200);
    for (const id of accountIds) assert.ok(users.data.some((user) => user._id === String(id)));
    responses.push(users.data);
    const events = await Notification.find(testNotifications).lean();
    assert.ok(events.length > 0);
    for (const id of accountIds) assert.ok(events.some((event) => String(event.user) === String(id) && event.kind === 'user.updated'));
    for (const token of [adminToken, ...accounts.map((item) => item.token)]) {
      const inbox = await call('GET', '/notifications', null, token);
      assert.equal(inbox.status, 200);
      assert.ok(inbox.data.items.some((item) => events.some((event) => String(event._id) === item._id)));
      responses.push(inbox.data);
    }
    assertPrivate(events);
    for (const response of responses) assertPrivate(response);
    assert.deepEqual(await User.findById(otherStudent._id).lean(), unrelated);
    assert.equal(typeof await login(otherStudent.phone), 'string');
  } finally {
    await Notification.deleteMany(testNotifications);
    await User.deleteMany({ _id: { $in: accountIds } });
  }
});

const lessonBody = () => ({ teacherId: teacher._id.toString(), subjectId: subject._id.toString(), groupIds: [group._id.toString()], date: day1, startTime: '08:30', endTime: '09:50', pairNumber: 1, room: '101', building: 'Test bino', type: "Ma'ruza" });

test('admin creates lesson and rejects scheduling conflicts', async () => {
  const slotsPath = (teacherId, groupId) => `/admin/lesson-slots?date=${day1}&teacherId=${teacherId}&groupIds=${groupId}`;
  const todaySlots = await call('GET', `/admin/lesson-slots?date=${today}&teacherId=${teacher._id}&groupIds=${group._id}`, null, adminToken);
  assert.equal(todaySlots.status, 400);
  assert.equal(todaySlots.data.message, 'Darsni kamida bir kun oldin biriktirish mumkin');
  assert.equal((await call('GET', `/admin/lesson-slots?date=${pastDay}&teacherId=${teacher._id}&groupIds=${group._id}`, null, adminToken)).status, 400);
  assert.equal((await call('POST', '/admin/lessons', { ...lessonBody(), date: today }, adminToken)).status, 400);
  assert.equal((await call('POST', '/admin/lessons', { ...lessonBody(), date: pastDay }, adminToken)).status, 400);

  let slots = (await call('GET', slotsPath(teacher._id, group._id), null, adminToken)).data.slots;
  assert.deepEqual(slots.map((slot) => slot.pairNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(slots[0], { pairNumber: 1, startTime: '08:30', endTime: '09:50' });
  assert.equal((await call('GET', '/admin/lesson-slots?date=2026-13-01&teacherId=' + teacher._id + '&groupIds=' + group._id, null, adminToken)).status, 400);
  assert.equal((await call('GET', '/admin/lesson-slots?date=' + day1 + '&teacherId=bad&groupIds=' + group._id, null, adminToken)).status, 400);
  assert.equal((await call('GET', '/admin/lesson-slots?date=' + day1 + '&teacherId=' + teacher._id + '&groupIds=bad', null, adminToken)).status, 400);

  const result = await call('POST', '/admin/lessons', lessonBody(), adminToken);
  assert.equal(result.status, 201); lessonId = result.data._id;
  assert.equal((await call('POST', '/admin/lessons', lessonBody(), adminToken)).status, 409);
  assert.equal((await call('POST', '/admin/lessons', { ...lessonBody(), startTime: '11:00', endTime: '10:00' }, adminToken)).status, 400);
  assert.equal((await call('POST', '/admin/lessons', { ...lessonBody(), pairNumber: 2 }, adminToken)).status, 400);

  slots = (await call('GET', slotsPath(teacher._id, group._id), null, adminToken)).data.slots;
  assert.deepEqual(slots.map((slot) => slot.pairNumber), [2, 3, 4, 5, 6, 7, 8, 9]);
  const groupBusy = (await call('GET', slotsPath(otherTeacher._id, group._id), null, adminToken)).data.slots;
  assert.deepEqual(groupBusy.map((slot) => slot.pairNumber), [2, 3, 4, 5, 6, 7, 8, 9]);
  const free = (await call('GET', slotsPath(otherTeacher._id, otherGroup._id), null, adminToken)).data.slots;
  assert.equal(free.length, 9);

  const workload = (await call('GET', `/admin/workload?weekStart=${day1}`, null, adminToken)).data;
  assert.equal(workload.dates[0], day1); assert.equal(workload.dates[5], addDays(day1, 5));
  assert.equal(workload.grid.find((t) => t.teacherId === teacher._id.toString()).cells[`${day1}_1`], true);
});

test('only assigned teacher can access lesson roster', async () => {
  const result = await call('GET', `/teacher/lessons/${lessonId}/attendance`, null, teacherToken);
  assert.equal(result.status, 200); assert.equal(result.data.students.length, 1);
  assert.equal(result.data.students[0].id, student._id.toString());
  assert.equal(result.data.attendanceLocked, false);
  assert.equal(result.data.attendanceAllowed, false);
  const token = await login(otherTeacher.phone);
  assert.equal((await call('GET', `/teacher/lessons/${lessonId}/attendance`, null, token)).status, 403);
  assert.equal((await call('PUT', `/teacher/lessons/${lessonId}/attendance`, { records: [{ studentId: student._id.toString(), status: 'present' }] }, token)).status, 403);
});

test('attendance rejects foreign students, invalid statuses, duplicates and incomplete rosters', async (t) => {
  const original = await Lesson.findById(lessonId).lean();
  await Lesson.updateOne({ _id: lessonId }, { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()), startTime: '00:00', endTime: '23:59' });
  t.after(async () => Lesson.updateOne({ _id: lessonId }, { date: original.date, startTime: original.startTime, endTime: original.endTime }));
  const path = `/teacher/lessons/${lessonId}/attendance`;
  assert.equal((await call('PUT', path, { records: [{ studentId: otherStudent._id.toString(), status: 'present' }] }, teacherToken)).status, 400);
  assert.equal((await call('PUT', path, { records: [{ studentId: student._id.toString(), status: 'invalid' }] }, teacherToken)).status, 400);
  const record = { studentId: student._id.toString(), status: 'present' };
  assert.equal((await call('PUT', path, { records: [record, record] }, teacherToken)).status, 400);
  assert.equal((await call('PUT', path, { records: [] }, teacherToken)).status, 400);
});

test('attendance is saved once, locked and visible to the student', async () => {
  const path = `/teacher/lessons/${lessonId}/attendance`;
  const original = await Lesson.findById(lessonId).lean();
  await Lesson.updateOne({ _id: lessonId }, { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()), startTime: '00:00', endTime: '23:59' });
  const saved = await call('PUT', path, { records: [{ studentId: student._id.toString(), status: 'present' }] }, teacherToken);
  await Lesson.updateOne({ _id: lessonId }, { date: original.date, startTime: original.startTime, endTime: original.endTime });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.attendanceLocked, true);
  let result = (await call('GET', '/student/attendance', null, studentToken)).data;
  assert.equal(result.present, 1); assert.equal(result.percentage, 100);
  const schedule = (await call('GET', `/student/schedule?weekStart=${day1}`, null, studentToken)).data;
  assert.equal(schedule.byDay[day1][0].myStatus, 'present');
  const roster = (await call('GET', path, null, teacherToken)).data;
  assert.equal(roster.attendanceLocked, true);
  assert.equal(roster.students[0].status, 'present');
  assert.equal((await call('PUT', path, { records: [{ studentId: student._id.toString(), status: 'absent' }] }, teacherToken)).status, 409);
  result = (await call('GET', path, null, teacherToken)).data;
  assert.equal(result.students[0].status, 'present');
  assert.equal((await call('GET', '/student/attendance', null, studentToken)).data.total, 1);
});

test('attendance cannot be taken for past lessons', async () => {
  const past = await Lesson.create({ teacher: teacher._id, subject: subject._id, groups: [group._id], date: pastDay, startTime: '08:30', endTime: '09:50', pairNumber: 1, room: '102', building: 'Test bino', type: "Ma'ruza" });
  const path = `/teacher/lessons/${past._id}/attendance`;
  const roster = await call('GET', path, null, teacherToken);
  assert.equal(roster.status, 200);
  assert.equal(roster.data.attendanceAllowed, false);
  assert.equal(roster.data.attendanceLocked, false);
  const rejected = await call('PUT', path, { records: [{ studentId: student._id.toString(), status: 'present' }] }, teacherToken);
  assert.equal(rejected.status, 400);
  assert.match(rejected.data.message, /Davomat faqat.*Toshkent vaqti/);
  assert.equal(await Attendance.countDocuments({ lesson: past._id }), 0);
  assert.equal((await Lesson.findById(past._id)).attendanceTakenAt, null);
});

test('errors are JSON and do not kill the server', async () => {
  assert.equal((await call('POST', '/admin/groups', { name: 'TEST-01' }, adminToken)).status, 409);
  assert.equal((await call('GET', '/teacher/lessons/not-an-id/attendance', null, teacherToken)).status, 400);
  assert.equal((await call('GET', '/unknown')).status, 404);
  assert.equal((await call('GET', '/health')).status, 200);
});

test('admin cannot demote or delete their own account', async () => {
  const admin = (await call('GET', '/auth/me', null, adminToken)).data.user;
  assert.equal((await call('PUT', `/admin/users/${admin.id}`, { role: 'teacher' }, adminToken)).status, 400);
  assert.equal((await call('DELETE', `/admin/users/${admin.id}`, null, adminToken)).status, 400);
});

test('lesson events reach only assigned teacher, enrolled students and admins', async () => {
  const items = await Notification.find({ kind: 'lesson.created', 'data.lessonId': lessonId });
  const recipients = items.map((item) => String(item.user));
  const admins = await User.find({ role: 'admin', approved: true });
  assert.deepEqual(recipients.sort(), [...admins.map((user) => String(user._id)), String(teacher._id), String(student._id)].sort());
  assert.equal(items.find((item) => item.user.equals(teacher._id)).url, `/teacher/lesson/${lessonId}/attendance`);
  assert.equal(recipients.includes(String(otherStudent._id)), false);
});

test('attendance notifications are private and only the first save counts', async () => {
  const created = await call('POST', '/admin/lessons', { ...lessonBody(), date: day2, startTime: '10:00', endTime: '11:20', pairNumber: 2 }, adminToken);
  assert.equal(created.status, 201);
  const path = `/teacher/lessons/${created.data._id}/attendance`;
  const records = [{ studentId: String(student._id), status: 'absent' }];
  const previous = await Notification.countDocuments();
  await Lesson.updateOne({ _id: created.data._id }, { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()), startTime: '00:00', endTime: '23:59' });
  assert.equal((await call('PUT', path, { records }, teacherToken)).status, 200);
  const changed = await Notification.countDocuments();
  assert.ok(changed > previous);
  const item = await Notification.findOne({ user: student._id, kind: 'attendance.updated' }).sort({ _id: -1 });
  assert.equal(item.data.status, 'absent');
  assert.equal(item.url, '/student/attendance');
  assert.equal(await Notification.countDocuments({ user: otherStudent._id, kind: 'attendance.updated' }), 0);
  assert.ok(await Notification.exists({ kind: 'attendance.saved', 'data.lessonId': String(created.data._id) }));
  assert.equal((await call('PUT', path, { records }, teacherToken)).status, 409);
  assert.equal(await Notification.countDocuments(), changed);
  assert.equal((await call('GET', path, null, teacherToken)).data.students[0].status, 'absent');
});

test('inbox and read status are authenticated, private and paginated', async () => {
  assert.equal((await call('GET', '/notifications')).status, 401);
  assert.equal((await call('GET', '/notifications/config')).status, 401);
  const foreign = await Notification.findOne({ user: teacher._id });
  assert.equal((await call('PUT', `/notifications/${foreign._id}/read`, {}, studentToken)).status, 404);
  assert.equal((await call('PUT', '/notifications/not-an-id/read', {}, studentToken)).status, 400);
  assert.equal((await call('GET', '/notifications?before=invalid', null, studentToken)).status, 400);
  await Notification.insertMany(Array.from({ length: 53 }, (_, i) => ({ user: student._id, kind: 'test', title: `Test ${i}`, body: 'Private', url: '/student' })));
  const first = (await call('GET', '/notifications', null, studentToken)).data;
  assert.equal(first.items.length, 50);
  assert.ok(first.nextCursor);
  assert.ok(first.items.every((item) => item.user === undefined && item.actor === undefined && item.queued === undefined));
  const second = (await call('GET', `/notifications?before=${first.nextCursor}`, null, studentToken)).data;
  assert.ok(second.items.length > 0);
  assert.equal(second.items.some((item) => first.items.some((a) => a._id === item._id)), false);
  for (let i = 0; i < 2; i++) assert.equal((await call('PUT', `/notifications/${first.items[0]._id}/read`, {}, studentToken)).status, 200);
  const foreignUnread = await Notification.countDocuments({ user: teacher._id, readAt: null });
  assert.equal((await call('PUT', '/notifications/read-all', {}, studentToken)).status, 200);
  assert.equal((await call('GET', '/notifications', null, studentToken)).data.unreadCount, 0);
  assert.equal(await Notification.countDocuments({ user: teacher._id, readAt: null }), foreignUnread);
});

test('preferences accept only channel booleans and never alter other users', async () => {
  for (const body of [{}, { web: 'false' }, { telegramId: '123' }, { admin: true }]) {
    assert.equal((await call('PUT', '/notifications/preferences', body, studentToken)).status, 400);
  }
  assert.equal((await call('PUT', '/notifications/preferences', { web: false, mobile: false, telegram: false }, studentToken)).status, 200);
  assert.deepEqual((await call('GET', '/notifications/config', null, studentToken)).data.preferences, { web: false, mobile: false, telegram: false });
  assert.equal((await call('GET', '/notifications/config', null, teacherToken)).data.preferences.web, true);
  await call('PUT', '/notifications/preferences', { web: true, mobile: true, telegram: true }, studentToken);
});

const webSubscription = (suffix = 'test') => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`, keys: { p256dh: vapid.publicKey, auth: randomBytes(16).toString('base64url') } });

test('push destinations reject SSRF and invalid keys and respect current ownership', async () => {
  const subscription = webSubscription();
  assert.equal((await call('POST', '/notifications/subscriptions', { type: 'web', subscription })).status, 401);
  for (const endpoint of ['http://fcm.googleapis.com/test', 'https://127.0.0.1/push', 'https://fcm.googleapis.com.evil.test/push', 'https://user:pass@fcm.googleapis.com/test', 'https://fcm.googleapis.com:8080/test']) {
    assert.equal((await call('POST', '/notifications/subscriptions', { type: 'web', subscription: { ...subscription, endpoint } }, teacherToken)).status, 400);
  }
  assert.equal((await call('POST', '/notifications/subscriptions', { type: 'web', subscription: { ...subscription, keys: { p256dh: 'bad', auth: 'bad' } } }, teacherToken)).status, 400);
  assert.equal((await call('POST', '/notifications/subscriptions', { type: 'expo', token: 'bad' }, teacherToken)).status, 400);
  assert.equal((await call('POST', '/notifications/subscriptions', { type: 'web', subscription }, teacherToken)).status, 201);
  assert.equal((await call('POST', '/notifications/subscriptions', { type: 'web', subscription }, studentToken)).status, 201);
  assert.equal(await Subscription.countDocuments({ endpoint: subscription.endpoint }), 1);
  assert.ok((await Subscription.findOne({ endpoint: subscription.endpoint })).user.equals(student._id));
  await call('DELETE', '/notifications/subscriptions', { type: 'web', endpoint: subscription.endpoint }, teacherToken);
  assert.equal(await Subscription.countDocuments({ endpoint: subscription.endpoint }), 1);
  await call('DELETE', '/notifications/subscriptions', { type: 'web', endpoint: subscription.endpoint }, studentToken);
  assert.equal(await Subscription.countDocuments({ endpoint: subscription.endpoint }), 0);
});

test('Telegram identity requires trusted bot secret, verified link and explicit unlink', async () => {
  const headers = { 'X-Oxu-Bot-Secret': process.env.BOT_LINK_SECRET };
  assert.equal((await call('PUT', '/auth/telegram', { telegramId: '123456789' }, studentToken)).status, 403);
  assert.equal((await call('PUT', '/auth/telegram', { telegramId: '123456789' }, studentToken, { 'X-Oxu-Bot-Secret': 'wrong' })).status, 403);
  assert.equal((await call('PUT', '/auth/telegram', { telegramId: '-123456789' }, studentToken, headers)).status, 400);
  await User.updateOne({ _id: student._id }, { telegramId: '123456789', telegramVerified: false });
  assert.equal((await call('GET', '/notifications/config', null, studentToken)).data.telegram.linked, false);
  assert.equal((await call('PUT', '/auth/telegram', { telegramId: '123456789' }, studentToken, headers)).status, 200);
  assert.equal((await call('GET', '/notifications/config', null, studentToken)).data.telegram.linked, true);
  await call('PUT', '/auth/telegram', { telegramId: '123456789' }, teacherToken, headers);
  assert.equal((await call('GET', '/notifications/config', null, studentToken)).data.telegram.linked, false);
  assert.equal((await call('PUT', '/auth/telegram', { telegramId: null }, teacherToken, headers)).status, 200);
  assert.equal((await call('GET', '/notifications/config', null, teacherToken)).data.telegram.linked, false);
});

test('account and catalog notifications omit credentials and do not duplicate no-op edits', async () => {
  const created = await Notification.find({ kind: 'user.created' });
  assert.ok(created.length > 0);
  assert.equal(JSON.stringify(created).includes('123456'), false);
  const body = { fullName: otherTeacher.fullName };
  const count = await Notification.countDocuments({ kind: 'user.updated' });
  await call('PUT', `/admin/users/${otherTeacher._id}`, body, adminToken);
  assert.equal(await Notification.countDocuments({ kind: 'user.updated' }), count);
  await call('PUT', `/admin/users/${otherTeacher._id}`, { fullName: 'Renamed Teacher' }, adminToken);
  assert.ok(await Notification.exists({ user: otherTeacher._id, kind: 'user.updated' }));
  const groupResult = await call('POST', '/admin/groups', { name: 'NOTIFICATION-TEST' }, adminToken);
  assert.equal(groupResult.status, 201);
  const events = await Notification.find({ kind: 'group.created' }).populate('user');
  assert.ok(events.length > 0);
  assert.ok(events.every((item) => item.user.role === 'admin'));
  assert.equal((await call('DELETE', `/admin/groups/${groupResult.data._id}`, null, adminToken)).status, 200);
  const deleted = await Notification.countDocuments({ kind: 'group.deleted' });
  assert.equal((await call('DELETE', `/admin/groups/${groupResult.data._id}`, null, adminToken)).status, 404);
  assert.equal(await Notification.countDocuments({ kind: 'group.deleted' }), deleted);
});

test('lesson cancellation publishes once to relevant recipients', async () => {
  assert.equal((await call('DELETE', `/admin/lessons/${lessonId}`, null, adminToken)).status, 200);
  const items = await Notification.find({ kind: 'lesson.deleted', 'data.lessonId': lessonId });
  assert.ok(items.some((item) => item.user.equals(student._id)));
  assert.equal(items.some((item) => item.user.equals(otherStudent._id)), false);
  assert.equal((await call('DELETE', `/admin/lessons/${lessonId}`, null, adminToken)).status, 404);
  assert.equal(await Notification.countDocuments({ kind: 'lesson.deleted', 'data.lessonId': lessonId }), items.length);
});

async function deliveryFixture(channel) {
  await Delivery.deleteMany({});
  await Subscription.deleteMany({});
  await Notification.updateMany({}, { queued: true });
  await User.updateOne({ _id: otherTeacher._id }, { approved: true, telegramId: '987654321', telegramVerified: true, notificationPreferences: { web: true, mobile: true, telegram: channel === 'telegram' } });
  const subscription = channel === 'telegram' ? null : await Subscription.create({ user: otherTeacher._id, type: channel, ...(channel === 'web' ? webSubscription('worker') : { endpoint: 'ExpoPushToken[isolated-test-device]' }) });
  const [notification] = await notifications.notifyUsers([otherTeacher._id], { kind: 'test', title: 'Test message', body: 'Private test body' });
  await notifications.prepareNotifications();
  return { notification, subscription, job: await Delivery.findOne({ notification: notification._id }) };
}

const due = (id) => Delivery.updateOne({ _id: id }, { nextAttemptAt: new Date(0), lockedUntil: new Date(0) });

test('Telegram lesson notification includes a protected attendance inline action', async (t) => {
  const { notification, job } = await deliveryFixture('telegram');
  const id = String(new mongoose.Types.ObjectId());
  await Notification.updateOne({ _id: notification._id }, { kind: 'lesson.created', data: { lessonId: id } });
  let body;
  t.mock.method(globalThis, 'fetch', async (url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ ok: true }) }; });
  await notifications.processPending();
  assert.equal((await Delivery.findById(job._id)).state, 'delivered');
  assert.equal(body.reply_markup.inline_keyboard[0][0].callback_data, `tch:l:${id}`);
  assert.match(body.text, /OXU DIGITAL/);
});

test('worker enqueues idempotently and retries temporary web failures', async (t) => {
  const { notification, job } = await deliveryFixture('web');
  await Notification.updateOne({ _id: notification._id }, { queued: false });
  await notifications.prepareNotifications();
  assert.equal(await Delivery.countDocuments({ notification: notification._id }), 1);
  let calls = 0;
  t.mock.method(webPush, 'sendNotification', async (_subscription, raw) => {
    calls += 1;
    assert.equal(JSON.parse(raw).notificationId, String(notification._id));
    if (calls === 1) throw Object.assign(new Error('temporary'), { statusCode: 503 });
  });
  t.mock.method(globalThis, 'fetch', async () => { assert.fail('No external HTTP request expected'); });
  await notifications.processPending();
  let updated = await Delivery.findById(job._id);
  assert.equal(updated.state, 'pending');
  assert.equal(updated.attempts, 1);
  assert.ok(updated.nextAttemptAt.getTime() > Date.now());
  await due(job._id);
  await notifications.processPending();
  updated = await Delivery.findById(job._id);
  assert.equal(updated.state, 'delivered');
  assert.equal(calls, 2);
  await notifications.processPending();
  assert.equal(calls, 2);
});

test('expired web subscriptions are removed and never retried', async (t) => {
  const { job, subscription } = await deliveryFixture('web');
  const send = t.mock.method(webPush, 'sendNotification', async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); });
  await notifications.processPending();
  assert.equal((await Delivery.findById(job._id)).state, 'failed');
  assert.equal(await Subscription.findById(subscription._id), null);
  await notifications.processPending();
  assert.equal(send.mock.callCount(), 1);
});

test('worker rechecks preference, approval, destination ownership and Telegram verification', async (t) => {
  const send = t.mock.method(webPush, 'sendNotification', async () => { assert.fail('Disabled destination must not receive a push'); });
  t.mock.method(globalThis, 'fetch', async () => { assert.fail('Unverified Telegram must not receive a message'); });
  for (const mutation of ['preference', 'approval', 'owner', 'unsubscribe', 'telegram']) {
    const { job, subscription } = await deliveryFixture(mutation === 'telegram' ? 'telegram' : 'web');
    if (mutation === 'preference') await User.updateOne({ _id: otherTeacher._id }, { 'notificationPreferences.web': false });
    if (mutation === 'approval') await User.updateOne({ _id: otherTeacher._id }, { approved: false });
    if (mutation === 'owner') await Subscription.updateOne({ _id: subscription._id }, { user: student._id });
    if (mutation === 'unsubscribe') await Subscription.deleteOne({ _id: subscription._id });
    if (mutation === 'telegram') await User.updateOne({ _id: otherTeacher._id }, { telegramVerified: false });
    await notifications.processPending();
    assert.equal((await Delivery.findById(job._id)).state, 'skipped', mutation);
  }
  assert.equal(send.mock.callCount(), 0);
});

test('Telegram rate limits respect retry_after without leaking credentials', async (t) => {
  const { job } = await deliveryFixture('telegram');
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.startsWith('https://api.telegram.org/'));
    assert.equal(JSON.parse(options.body).chat_id, '987654321');
    calls += 1;
    return calls === 1 ? new Response(JSON.stringify({ ok: false, parameters: { retry_after: 120 } }), { status: 429 }) : new Response(JSON.stringify({ ok: true }));
  });
  await notifications.processPending();
  let updated = await Delivery.findById(job._id);
  assert.equal(updated.state, 'pending');
  assert.ok(updated.nextAttemptAt.getTime() > Date.now() + 110000);
  assert.equal(updated.errorCode, 'HTTP_429');
  await due(job._id);
  await notifications.processPending();
  assert.equal((await Delivery.findById(job._id)).state, 'delivered');
});

test('Expo tickets are checked through receipts and invalid devices are removed', async (t) => {
  let receiptError = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/send')) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.channelId, 'oxu-updates');
      return new Response(JSON.stringify({ data: { status: 'ok', id: 'test-ticket' } }));
    }
    assert.ok(url.endsWith('/getReceipts'));
    return new Response(JSON.stringify({ data: { 'test-ticket': receiptError ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' } } }));
  });
  for (const invalid of [false, true]) {
    receiptError = invalid;
    const { job, subscription } = await deliveryFixture('expo');
    await notifications.processPending();
    assert.equal((await Delivery.findById(job._id)).state, 'receipt');
    await due(job._id);
    await notifications.processPending();
    assert.equal((await Delivery.findById(job._id)).state, invalid ? 'failed' : 'delivered');
    assert.equal(Boolean(await Subscription.findById(subscription._id)), !invalid);
  }
});

test('expired final-attempt leases become terminal without another send', async (t) => {
  t.mock.method(webPush, 'sendNotification', async () => { assert.fail('Retry limit exhausted'); });
  t.mock.method(globalThis, 'fetch', async () => { assert.fail('Receipt limit exhausted'); });
  for (const channel of ['web', 'expo']) {
    const { job } = await deliveryFixture(channel);
    await Delivery.updateOne({ _id: job._id }, channel === 'web' ? { attempts: 6 } : { state: 'receipt', ticketId: 'test-ticket', receiptChecks: 30 });
    await notifications.processPending();
    const updated = await Delivery.findById(job._id);
    assert.equal(updated.state, 'failed');
    assert.equal(updated.errorCode, 'RETRY_LIMIT_REACHED');
  }
});
