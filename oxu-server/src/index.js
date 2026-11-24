require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');

const app = express();
app.disable('x-powered-by');
app.use(require('helmet')());
app.use(cors({ origin(origin, callback) { callback(null, require('./realtime').originAllowed(origin)); } }));
const { rateLimit } = require('express-rate-limit');
app.use('/api',rateLimit({windowMs:60000,limit:600,standardHeaders:true,legacyHeaders:false,message:{message:'So‘rovlar ko‘p. Birozdan keyin urinib ko‘ring.'}}));
app.use('/api/auth/login',rateLimit({windowMs:900000,limit:30,skipSuccessfulRequests:true,standardHeaders:true,legacyHeaders:false,message:{message:'Kirish urinishlari ko‘p. 15 daqiqadan keyin urinib ko‘ring.'}}));
app.use(express.json({ limit: '512kb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/student'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'oxu-server' }));
app.use((req, res) => res.status(404).json({ message: 'Manzil topilmadi' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Yuborilgan ma’lumot hajmi katta' });
  if (err.code === 11000) return res.status(409).json({ message: 'Bu ma’lumot allaqachon mavjud' });
  if (['ValidationError', 'CastError', 'SyntaxError'].includes(err.name)) {
    return res.status(400).json({ message: 'Kiritilgan ma’lumot noto‘g‘ri' });
  }
  console.error('API xatosi:', err.message);
  res.status(500).json({ message: 'Server xatosi' });
});

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'oxu_digital_secret_key_2026')) {
  throw new Error('Production uchun kuchli JWT_SECRET belgilang');
}

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB().then(async () => {
    if (process.env.NODE_ENV !== 'production') {
      const User = require('./models/User');
      if ((await User.countDocuments()) === 0) await require('./seed')();
    }
    const server = app.listen(PORT, () => console.log(`oxu-server ishga tushdi: http://localhost:${PORT}`));
    require('./realtime').attach(server);
    const stopNotifications = process.env.DISABLE_EXTERNAL_DELIVERY === '1'
      ? async () => {}
      : require('./notifications').startWorker();
    const shutdown = async () => {
      await stopNotifications();
      server.close(async () => { await require('mongoose').disconnect(); process.exit(0); });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch((err) => { console.error(err.message); process.exit(1); });
}
