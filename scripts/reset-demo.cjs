// Explicit local demo reset. Preserves administrator access.
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'oxu-server/package.json'));
async function main() {
  const { MongoMemoryServer } = req('mongodb-memory-server');
  const mongoose = req('mongoose');
  const mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.join(root, 'oxu-server/node_modules/.cache/mongodb-memory-server') }, instance: { dbPath: path.join(root, '.local-data/mongo'), storageEngine: 'wiredTiger', dbName: 'oxu_demo' } });
  try {
    await mongoose.connect(mongo.getUri('oxu_demo'));
    const User = req('./src/models/User');
    if (!await User.exists({ role: 'admin' })) throw new Error('Admin account missing; reset cancelled');
    for (const name of ['Attendance','Lesson','NotificationDelivery','Notification','PushSubscription','Group','Subject']) {
      const result = await req(`./src/models/${name}`).deleteMany({});
      console.log(name, result.deletedCount);
    }
    const result = await User.deleteMany({ role: { $ne: 'admin' } });
    console.log('Non-admin users', result.deletedCount);
    console.log('Remaining admins', await User.countDocuments({ role: 'admin' }));
  } finally { await mongoose.disconnect(); await mongo.stop(); }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
