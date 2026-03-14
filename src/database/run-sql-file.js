/**
 * Run a single SQL file against the configured database.
 * Usage: node src/database/run-sql-file.js <path-to.sql>
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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
    .filter((s) => s.length > 0 && (s.toUpperCase().startsWith('CREATE') || s.toUpperCase().startsWith('INSERT') || s.toUpperCase().startsWith('ALTER')));
}

async function run() {
  const relPath = process.argv[2];
  if (!relPath) {
    console.error('Usage: node run-sql-file.js <path-to.sql>');
    process.exit(1);
  }
  const filePath = path.isAbsolute(relPath) ? relPath : path.join(__dirname, '..', '..', relPath);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = parseStatements(sql);
  let conn;
  try {
    conn = await mysql.createConnection({
      ...config,
      multipleStatements: false,
    });
    for (const stmt of statements) {
      if (stmt) await conn.query(stmt);
    }
    console.log('Executed', statements.length, 'statement(s) from', path.basename(filePath));
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
