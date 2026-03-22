/**
 * Single migration: creates the database (if needed) and applies schema.sql (all tables).
 * Usage (from backend folder): npm run migrate
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

function parseCreateStatements(sql) {
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
    const dbName = config.database;
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: false,
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.query(`USE \`${dbName}\``);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = parseCreateStatements(sql);
    for (const stmt of statements) {
      if (stmt) await conn.query(stmt);
    }
    console.log('Migration OK: applied', statements.length, 'CREATE statements from schema.sql');

    try {
      await conn.query('ALTER TABLE ads MODIFY COLUMN society_id INT UNSIGNED NULL');
      console.log('Patch OK: ads.society_id is nullable (platform-wide ads)');
    } catch (e) {
      const ignorable =
        e.code === 'ER_BAD_FIELD_ERROR' ||
        e.code === 'ER_NO_SUCH_TABLE' ||
        /Unknown table|check that column exists/i.test(e.message || '');
      if (!ignorable) console.warn('Patch ads nullable skipped:', e.message);
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
