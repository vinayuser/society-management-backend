/**
 * Add payment fields to billing table for society monthly/yearly payments and Razorpay.
 * Run: node src/database/payments-migrate.js
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

    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'billing'`,
      [db]
    );
    const names = cols.map((c) => c.COLUMN_NAME);

    if (!names.includes('previous_balance')) {
      await conn.query(
        'ALTER TABLE billing ADD COLUMN previous_balance DECIMAL(12,2) DEFAULT NULL AFTER notes'
      );
      console.log('Added billing.previous_balance');
    }
    if (!names.includes('razorpay_order_id')) {
      await conn.query(
        'ALTER TABLE billing ADD COLUMN razorpay_order_id VARCHAR(128) DEFAULT NULL AFTER previous_balance'
      );
      console.log('Added billing.razorpay_order_id');
    }
    if (!names.includes('razorpay_payment_id')) {
      await conn.query(
        'ALTER TABLE billing ADD COLUMN razorpay_payment_id VARCHAR(128) DEFAULT NULL AFTER razorpay_order_id'
      );
      console.log('Added billing.razorpay_payment_id');
    }

    console.log('Payments migration done.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
