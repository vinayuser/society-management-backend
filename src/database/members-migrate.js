/**
 * Members module: create members, member_family, member_emergency_contacts, member_documents, member_vehicles.
 * Run: node src/database/members-migrate.js
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

    const sqlPath = path.join(__dirname, 'members-enhance-migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.replace(/--[\s\S]*?$/gm, '').trim())
      .filter((s) => s.length > 0 && s.toUpperCase().startsWith('CREATE'));
    for (const stmt of statements) {
      await conn.query(stmt);
      if (stmt.includes('CREATE TABLE') && stmt.includes('members')) console.log('Created table:', stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'members');
    }
    console.log('Members module migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
