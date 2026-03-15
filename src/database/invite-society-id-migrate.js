/**
 * Add society_id to society_invites (set when invite is accepted, for payment flow).
 * Run: node src/database/invite-society-id-migrate.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'society_management',
};

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'society_invites'`,
      [config.database]
    );
    const names = cols.map((c) => c.COLUMN_NAME);
    if (!names.includes('society_id')) {
      await conn.query(
        'ALTER TABLE society_invites ADD COLUMN society_id INT UNSIGNED DEFAULT NULL AFTER status, ADD INDEX idx_society_id (society_id)'
      );
      console.log('Added society_invites.society_id');
    } else {
      console.log('society_invites.society_id already exists');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
