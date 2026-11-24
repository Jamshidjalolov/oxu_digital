const webPush = require('web-push');
const User = require('./models/User');
const Subject = require('./models/Subject');
const Notification = require('./models/Notification');
const Subscription = require('./models/PushSubscription');
const Delivery = require('./models/NotificationDelivery');

const preferences = (user) => ({ web: user.notificationPreferences?.web !== false, mobile: user.notificationPreferences?.mobile !== false, telegram: user.notificationPreferences?.telegram !== false });
const webConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

async function notifyUsers(ids, message) {
  const users = await User.find({ _id: { $in: [...new Set(ids.filter(Boolean).map(String))] }, approved: true }).select('_id role');
  if (!users.length) return [];
  const created = await Notification.insertMany(users.map((user) => ({
    user: user._id, actor: message.actor, kind: message.kind,
    title: message.title.slice(0, 200), body: message.body.slice(0, 2000),
    url: message.urls?.[user.role] || `/${user.role}`,
    data: message.data || {},
  })));
  require('./realtime').publish([...users.map(u=>u._id),message.actor]);
  return created;
}

async function notifyAdmins(message, extra = []) {
  const admins = await User.find({ role: 'admin', approved: true }).select('_id');
  return notifyUsers([...admins.map((user) => user._id), ...extra], message);
}

async function notifyLesson(lesson, actor, removed = false, note = '') {
  const students = await User.find({ role: 'student', approved: true, group: { $in: lesson.groups } }).select('_id');
  const subject = await Subject.findById(lesson.subject).select('name');
  const detail = `📚 ${subject?.name || 'Dars'}\n📅 ${lesson.date}\n🕗 ${lesson.startTime}–${lesson.endTime} · ${lesson.pairNumber}-para\n🏛 ${lesson.building || 'Bino ko‘rsatilmagan'}\n🚪 ${lesson.room || 'Xona ko‘rsatilmagan'}\n\n${removed ? 'Jadvalingizni tekshiring.' : 'Davomat dars boshlanishida ochiladi va dars tugaganda yopiladi. Toshkent vaqti.'}`;
  return notifyAdmins({
    actor, kind: removed ? 'lesson.deleted' : 'lesson.created',
    title: removed ? 'Dars bekor qilindi' : 'Yangi dars biriktirildi',
    body: note ? `${detail}. ${note}.` : detail,
    urls: { admin: '/admin/schedule', teacher: removed ? '/teacher' : `/teacher/lesson/${lesson._id}/attendance`, student: '/student' },
    data: { lessonId: String(lesson._id), target: 'schedule' },
  }, [lesson.teacher, ...students.map((student) => student._id)]);
}

async function prepareNotifications() {
  const pending = await Notification.find({ queued: false }).sort({ createdAt: 1 }).limit(100);
  for (const notification of pending) {
    const user = await User.findById(notification.user).select('approved telegramId telegramVerified notificationPreferences');
    if (user?.approved) {
      const prefs = preferences(user);
      const subscriptions = await Subscription.find({ user: user._id });
      const jobs = subscriptions.filter((sub) => sub.type === 'web' ? prefs.web : prefs.mobile).map((sub) => ({
        notification: notification._id, user: user._id, channel: sub.type,
        destination: String(sub._id), subscription: sub._id,
      }));
      if (prefs.telegram && user.telegramId && user.telegramVerified) jobs.push({ notification: notification._id, user: user._id, channel: 'telegram', destination: user.telegramId });
      if (jobs.length) await Delivery.bulkWrite(jobs.map((job) => ({ updateOne: {
        filter: { notification: job.notification, channel: job.channel, destination: job.destination },
        update: { $setOnInsert: job }, upsert: true,
      } })));
    }
    await Notification.updateOne({ _id: notification._id }, { queued: true });
  }
}

function deliveryError(code, permanent = false, removeSubscription = false, retryAfter = 0) {
  return Object.assign(new Error('Notification delivery failed'), { code, permanent, removeSubscription, retryAfter });
}

async function postJSON(url, body, headers = {}) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw deliveryError(`HTTP_${response.status}`, [400, 403, 404, 410].includes(response.status), false, result.parameters?.retry_after || Number(response.headers.get('retry-after')) || 0);
  }
  return response.json();
}

async function send(job, user, notification, subscription) {
  const payload = { title: notification.title, body: notification.body, url: notification.url, notificationId: String(notification._id), ...notification.data };
  if (job.channel === 'web') {
    try {
      await webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } }, JSON.stringify(payload), {
        vapidDetails: { subject: process.env.VAPID_SUBJECT, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }, TTL: 3600, timeout: 10000,
      });
    } catch (error) {
      throw deliveryError(`WEB_${error.statusCode || 'NETWORK'}`, [400, 404, 410].includes(error.statusCode), [404, 410].includes(error.statusCode));
    }
    return { state: 'delivered' };
  }
  if (job.channel === 'telegram') {
    const lessonId = notification.data?.lessonId;
    const attendanceButton = user.role === 'teacher' && notification.kind === 'lesson.created' && /^[a-f0-9]{24}$/i.test(lessonId || '');
    const result = await postJSON(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { chat_id: user.telegramId, text: `🏛 OXU DIGITAL\n━━━━━━━━━━━━━━━━\n${notification.title}\n\n${notification.body}`, reply_markup: { inline_keyboard: [...(attendanceButton ? [[{ text: '📋 Dars va davomat', callback_data: `tch:l:${lessonId}` }]] : []), [{ text: '🔔 Bildirishnomalar', callback_data: 'ntf:open' }]] } });
    if (!result.ok) throw deliveryError(`TELEGRAM_${result.error_code || 'REJECTED'}`, [400, 403].includes(result.error_code), false, result.parameters?.retry_after || 0);
    return { state: 'delivered' };
  }
  const headers = process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {};
  if (job.state === 'receipt') {
    const result = await postJSON('https://exp.host/--/api/v2/push/getReceipts', { ids: [job.ticketId] }, headers);
    const receipt = result.data?.[job.ticketId];
    if (!receipt) return { state: job.receiptChecks >= 30 ? 'failed' : 'receipt', nextAttemptAt: new Date(Date.now() + 60000), errorCode: 'EXPO_RECEIPT_PENDING' };
    if (receipt.status !== 'ok') throw deliveryError(`EXPO_${receipt.details?.error || 'REJECTED'}`, true, receipt.details?.error === 'DeviceNotRegistered');
    return { state: 'delivered' };
  }
  const result = await postJSON('https://exp.host/--/api/v2/push/send', { to: subscription.endpoint, title: payload.title, body: payload.body, data: payload, channelId: 'oxu-updates', priority: 'high', sound: 'default', ttl: 3600 }, headers);
  const ticket = result.data;
  if (ticket?.status !== 'ok' || !ticket.id) throw deliveryError(`EXPO_${ticket?.details?.error || 'REJECTED'}`, ['DeviceNotRegistered', 'InvalidCredentials', 'MessageTooBig'].includes(ticket?.details?.error), ticket?.details?.error === 'DeviceNotRegistered');
  return { state: 'receipt', ticketId: ticket.id, receiptChecks: 0, nextAttemptAt: new Date(Date.now() + 60000) };
}

async function processPending(limit = 20) {
  await prepareNotifications();
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const job = await Delivery.findOneAndUpdate({
      state: { $in: ['pending', 'receipt'] },
      nextAttemptAt: { $lte: now }, lockedUntil: { $lte: now },
    }, { lockedUntil: new Date(Date.now() + 75000) }, { new: true, sort: { nextAttemptAt: 1 } });
    if (!job) break;
    let update;
    try {
      const [user, notification, subscription] = await Promise.all([
        User.findById(job.user).select('role approved telegramId telegramVerified notificationPreferences'),
        Notification.findById(job.notification),
        job.subscription ? Subscription.findById(job.subscription) : null,
      ]);
      const prefs = user ? preferences(user) : {};
      const enabled = job.channel === 'web' ? prefs.web : job.channel === 'expo' ? prefs.mobile : prefs.telegram;
      const validDestination = job.channel === 'telegram' ? user?.telegramVerified && user.telegramId === job.destination : subscription?.user.toString() === job.user.toString();
      if (!user?.approved || !notification || !enabled || !validDestination) {
        update = { state: 'skipped', errorCode: 'DESTINATION_DISABLED' };
      } else if (job.state === 'receipt' ? job.receiptChecks >= 30 : job.attempts >= 6) {
        update = { state: 'failed', errorCode: 'RETRY_LIMIT_REACHED' };
      } else if ((job.channel === 'web' && !webConfigured()) || (job.channel === 'telegram' && !process.env.TELEGRAM_BOT_TOKEN)) {
        update = { nextAttemptAt: new Date(Date.now() + 60000), errorCode: 'CHANNEL_NOT_CONFIGURED' };
      } else {
        const counter = job.state === 'receipt' ? 'receiptChecks' : 'attempts';
        job[counter] += 1;
        await Delivery.updateOne({ _id: job._id }, { $inc: { [counter]: 1 } });
        update = await send(job, user, notification, subscription);
        if (update.state === 'delivered') update.errorCode = '';
      }
    } catch (error) {
      if (error.removeSubscription && job.subscription) await Subscription.deleteOne({ _id: job.subscription, user: job.user });
      const terminal = error.permanent || (job.state === 'receipt' ? job.receiptChecks >= 30 : job.attempts >= 6);
      update = { state: terminal ? 'failed' : job.state, errorCode: String(error.code || 'DELIVERY_ERROR').slice(0, 80), nextAttemptAt: new Date(Date.now() + Math.max(error.retryAfter * 1000 || 0, Math.min(3600000, 10000 * 2 ** job.attempts))) };
    }
    await Delivery.updateOne({ _id: job._id }, { ...update, lockedUntil: new Date(0) });
  }
}

function startWorker() {
  let active = null;
  const tick = () => {
    if (active) return;
    active = processPending().catch(() => console.error('Bildirishnoma navbatini qayta ishlashda xatolik')).finally(() => { active = null; });
  };
  const timer = setInterval(tick, 5000);
  timer.unref();
  tick();
  return async () => { clearInterval(timer); if (active) await active; };
}

module.exports = { notifyUsers, notifyAdmins, notifyLesson, preferences, webConfigured, prepareNotifications, processPending, startWorker };
