/**
 * Run backfill: create member rows for existing residents.
 * Usage: node src/database/run-backfill-members.js
 * Uses DB config from .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

const sqlPath = path.join(__dirname, 'backfill-members-from-residents.sql');
const sql = fs.readFileSync(sqlPath, 'utf8')
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter((s) => s.length > 0);

async function run() {
  let conn;
  try {
    conn = await db.pool.getConnection();
    for (const statement of sql) {
      if (!statement) continue;
      const [result] = await conn.execute(statement);
      if (result.affectedRows !== undefined) {
        console.log('Rows affected:', result.affectedRows);
      }
    }
    console.log('Backfill done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

run();
