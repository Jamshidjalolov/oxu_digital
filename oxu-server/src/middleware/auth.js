const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Token topilmadi' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('-password').populate('group', 'name').populate('department', 'name code');
    if (!user) return res.status(401).json({ message: 'Foydalanuvchi topilmadi' });
    if (!user.approved) return res.status(403).json({ message: 'Hisob tasdiqlanmagan' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token yaroqsiz' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Ruxsat yo‘q' });
  }
  next();
};

module.exports = { auth, requireRole };
