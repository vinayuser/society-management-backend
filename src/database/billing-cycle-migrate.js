/**
 * Add billing_cycle (monthly/quarterly/yearly) and yearly_fee to invites and societies;
 * add 'quarterly' and 'yearly' to billing type enum.
 * Run: node src/database/billing-cycle-migrate.js
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
    const db = config.database;

    for (const table of ['society_invites', 'societies']) {
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [db, table]
      );
      const names = cols.map((c) => c.COLUMN_NAME);
      if (!names.includes('billing_cycle')) {
        await conn.query(
          `ALTER TABLE ${table} ADD COLUMN billing_cycle VARCHAR(16) NOT NULL DEFAULT 'monthly' AFTER monthly_fee`
        );
        console.log(`Added ${table}.billing_cycle`);
      }
      if (!names.includes('yearly_fee')) {
        await conn.query(
          `ALTER TABLE ${table} ADD COLUMN yearly_fee DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER billing_cycle`
        );
        console.log(`Added ${table}.yearly_fee`);
      }
    }

    const [billingCols] = await conn.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'billing' AND COLUMN_NAME = 'type'`,
      [db]
    );
    if (billingCols.length && billingCols[0].COLUMN_TYPE.indexOf('yearly') === -1) {
      await conn.query(
        `ALTER TABLE billing MODIFY COLUMN type ENUM('setup','monthly','quarterly','yearly') NOT NULL`
      );
      console.log("Added 'quarterly' and 'yearly' to billing.type");
    } else {
      console.log("billing.type already includes quarterly/yearly");
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
