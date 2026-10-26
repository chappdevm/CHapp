const path = require('path');
const os = require('os');
const fs = require('fs');
const { createHandler } = require('../index');
const { ERPStore } = require('../server/store');

// On Vercel / serverless, filesystem is read-only except /tmp
const tmpDbPath = path.join(os.tmpdir(), 'chapp_erp_db.json');

// Initialize with seed data if not yet created in /tmp
if (!fs.existsSync(tmpDbPath)) {
  const seedPath = path.join(__dirname, '..', 'data', 'db.json');
  if (fs.existsSync(seedPath)) {
    try {
      fs.copyFileSync(seedPath, tmpDbPath);
    } catch (e) {
      // Fallback handled by ERPStore
    }
  }
}

const store = new ERPStore(tmpDbPath);
const handler = createHandler(store);

module.exports = (req, res) => {
  return handler(req, res);
};
