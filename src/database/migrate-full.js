/**
 * Fresh install: create database (if not exists) and run the consolidated schema-full.sql.
 * Use this for new environments instead of running schema.sql + individual migrations.
 * Usage: node src/database/migrate-full.js
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

function parseStatements(sql) {
  const stripped = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toUpperCase().startsWith('CREATE'));
}

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: false,
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    await conn.query(`USE \`${config.database}\``);

    const schemaPath = path.join(__dirname, 'schema-full.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = parseStatements(sql);
    for (const stmt of statements) {
      if (stmt) await conn.query(stmt);
    }
    console.log('Full schema applied successfully (' + statements.length + ' tables).');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
