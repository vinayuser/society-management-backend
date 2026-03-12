/**
 * Flats enhancement: add floor, flat_type, area_sqft, ownership_type, owner_name, owner_contact, owner_email, status to flats.
 * Create flat_members, flat_vehicles, flat_documents.
 * Run: node src/database/flats-migrate.js
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

const flatColumns = [
  { name: 'floor', sql: 'ADD COLUMN floor INT UNSIGNED DEFAULT NULL AFTER flat_number' },
  { name: 'flat_type', sql: "ADD COLUMN flat_type VARCHAR(32) DEFAULT NULL AFTER floor" },
  { name: 'area_sqft', sql: 'ADD COLUMN area_sqft DECIMAL(10,2) DEFAULT NULL AFTER flat_type' },
  { name: 'ownership_type', sql: "ADD COLUMN ownership_type VARCHAR(32) DEFAULT NULL AFTER area_sqft" },
  { name: 'owner_name', sql: 'ADD COLUMN owner_name VARCHAR(255) DEFAULT NULL AFTER ownership_type' },
  { name: 'owner_contact', sql: 'ADD COLUMN owner_contact VARCHAR(32) DEFAULT NULL AFTER owner_name' },
  { name: 'owner_email', sql: 'ADD COLUMN owner_email VARCHAR(255) DEFAULT NULL AFTER owner_contact' },
  { name: 'status', sql: "ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active' AFTER owner_email" },
];

async function columnExists(conn, table, colName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.database, table, colName]
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

    for (const col of flatColumns) {
      const exists = await columnExists(conn, 'flats', col.name);
      if (!exists) {
        await conn.query(`ALTER TABLE flats ${col.sql}`);
        console.log('Added column flats.' + col.name);
      }
    }

    const billingHasFlat = await columnExists(conn, 'billing', 'flat_id');
    if (!billingHasFlat) {
      await conn.query('ALTER TABLE billing ADD COLUMN flat_id INT UNSIGNED DEFAULT NULL AFTER society_id, ADD INDEX idx_flat_id (flat_id), ADD FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE SET NULL');
      console.log('Added billing.flat_id');
    }

    const sqlPath = path.join(__dirname, 'flats-enhance-migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.replace(/--[\s\S]*?$/gm, '').trim())
      .filter((s) => s.length > 0 && s.toUpperCase().startsWith('CREATE'));
    for (const stmt of statements) {
      await conn.query(stmt);
      if (stmt.includes('flat_members')) console.log('Created table flat_members');
      if (stmt.includes('flat_vehicles')) console.log('Created table flat_vehicles');
      if (stmt.includes('flat_documents')) console.log('Created table flat_documents');
    }

    console.log('Flats enhancement migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
