/**
 * Add society_invites.address if missing (single society address used everywhere).
 * Safe to run multiple times.
 * Run: node src/database/invite-address-migrate.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'society_management',
};

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({ ...config, multipleStatements: false });
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'society_invites' AND COLUMN_NAME = 'address'`,
      [config.database]
    );
    if (rows.length > 0) {
      console.log('society_invites.address already exists.');
      return;
    }
    await conn.query('ALTER TABLE society_invites ADD COLUMN address TEXT DEFAULT NULL AFTER monthly_fee');
    console.log('Added society_invites.address.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
