/**
 * Add invite_id to billing for invite-level setup fee (one-time).
 * Allow society_id to be NULL when invite_id is set.
 * Run: node src/database/billing-invite-id-migrate.js
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
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'billing'`,
      [config.database]
    );
    const names = cols.map((c) => c.COLUMN_NAME);

    if (!names.includes('invite_id')) {
      await conn.query(
        `ALTER TABLE billing ADD COLUMN invite_id INT UNSIGNED DEFAULT NULL AFTER society_id, ADD INDEX idx_invite_id (invite_id)`
      );
      console.log('Added billing.invite_id');
    }

    const [societyCol] = await conn.query(
      `SELECT IS_NULLABLE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'billing' AND COLUMN_NAME = 'society_id'`,
      [config.database]
    );
    if (societyCol.length && societyCol[0].IS_NULLABLE === 'NO') {
      const [fks] = await conn.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'billing' AND COLUMN_NAME = 'society_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [config.database]
      );
      if (fks.length) {
        try {
          await conn.query(`ALTER TABLE billing DROP FOREIGN KEY ${fks[0].CONSTRAINT_NAME}`);
        } catch (_) {}
      }
      await conn.query(`ALTER TABLE billing MODIFY COLUMN society_id INT UNSIGNED DEFAULT NULL`);
      if (fks.length) {
        try {
          await conn.query(`ALTER TABLE billing ADD CONSTRAINT billing_society_fk FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE`);
        } catch (_) {}
      }
      console.log('Made billing.society_id nullable');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
