/**
 * Guard Management module migration.
 * Extends guards table with profile_picture, email, employee_id, role, assigned_blocks, joining_date.
 * Creates guard_shifts, guard_leaves, guard_documents.
 * Run: node src/database/guard-migrate.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'society_management',
};

const guardColumns = [
  { name: 'profile_picture', sql: 'ADD COLUMN profile_picture VARCHAR(512) DEFAULT NULL AFTER phone' },
  { name: 'email', sql: 'ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER profile_picture' },
  { name: 'employee_id', sql: 'ADD COLUMN employee_id VARCHAR(64) DEFAULT NULL AFTER email' },
  { name: 'role', sql: "ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'guard' AFTER employee_id" },
  { name: 'assigned_blocks', sql: 'ADD COLUMN assigned_blocks VARCHAR(255) DEFAULT NULL AFTER role' },
  { name: 'joining_date', sql: 'ADD COLUMN joining_date DATE DEFAULT NULL AFTER assigned_blocks' },
];

async function columnExists(conn, colName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guards' AND COLUMN_NAME = ?`,
    [config.database, colName]
  );
  return rows.length > 0;
}

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: true,
    });

    for (const col of guardColumns) {
      const exists = await columnExists(conn, col.name);
      if (!exists) {
        await conn.query(`ALTER TABLE guards ${col.sql}`);
        console.log('Added column guards.' + col.name);
      }
    }

    const sqlPath = path.join(__dirname, 'guard-management-migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.replace(/--[\s\S]*?$/gm, '').trim())
      .filter((s) => s.length > 0 && s.toUpperCase().startsWith('CREATE'));
    for (const stmt of statements) {
      await conn.query(stmt);
      if (stmt.includes('guard_shifts')) console.log('Created table guard_shifts');
      if (stmt.includes('guard_leaves')) console.log('Created table guard_leaves');
      if (stmt.includes('guard_documents')) console.log('Created table guard_documents');
    }

    console.log('Guard management migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
