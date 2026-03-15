/**
 * Add reminder_sent_at to billing; create society_notifications table.
 * Run: node src/database/society-notifications-migrate.js
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

    const [billingCols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'billing'`,
      [config.database]
    );
    const billingNames = billingCols.map((c) => c.COLUMN_NAME);
    if (!billingNames.includes('reminder_sent_at')) {
      await conn.query(
        `ALTER TABLE billing ADD COLUMN reminder_sent_at TIMESTAMP NULL DEFAULT NULL AFTER paid_at`
      );
      console.log('Added billing.reminder_sent_at');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS society_notifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        society_id INT UNSIGNED NOT NULL,
        type VARCHAR(32) NOT NULL DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        body TEXT DEFAULT NULL,
        reference_id INT UNSIGNED DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_society_id (society_id),
        INDEX idx_society_read (society_id, read_at),
        FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
      )
    `);
    console.log('society_notifications table ready');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
