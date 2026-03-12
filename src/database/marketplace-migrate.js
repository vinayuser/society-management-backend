/**
 * Marketplace enhancement: add category, condition, media_urls, is_pinned, listed_globally to marketplace_items;
 * create marketplace_transactions.
 * Run: node src/database/marketplace-migrate.js
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

const marketplaceColumns = [
  { name: 'category', sql: "ADD COLUMN category VARCHAR(64) DEFAULT NULL AFTER status" },
  { name: 'item_condition', sql: "ADD COLUMN item_condition VARCHAR(16) NOT NULL DEFAULT 'used' AFTER category" },
  { name: 'media_urls', sql: 'ADD COLUMN media_urls JSON DEFAULT NULL AFTER price' },
  { name: 'is_pinned', sql: 'ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER status' },
  { name: 'listed_globally', sql: 'ADD COLUMN listed_globally TINYINT(1) NOT NULL DEFAULT 0 AFTER is_pinned' },
];

async function columnExists(conn, colName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'marketplace_items' AND COLUMN_NAME = ?`,
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

    for (const col of marketplaceColumns) {
      const exists = await columnExists(conn, col.name);
      if (!exists) {
        await conn.query(`ALTER TABLE marketplace_items ${col.sql}`);
        console.log('Added column marketplace_items.' + col.name);
      }
    }

    const sqlPath = path.join(__dirname, 'marketplace-enhance-migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.replace(/--[\s\S]*?$/gm, '').trim())
      .filter((s) => s.length > 0 && s.toUpperCase().startsWith('CREATE'));
    for (const stmt of statements) {
      await conn.query(stmt);
      if (stmt.includes('marketplace_transactions')) console.log('Created table marketplace_transactions');
    }

    console.log('Marketplace enhancement migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
