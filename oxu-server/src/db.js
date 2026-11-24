const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/oxu_digital';
  await mongoose.connect(uri);
  console.log('MongoDB ulandi');
  return uri;
}

module.exports = connectDB;
