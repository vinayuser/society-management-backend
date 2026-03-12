require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'society_management',
};

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@society.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection(config);

    const [existing] = await conn.execute(
      'SELECT id FROM users WHERE email = ? AND society_id IS NULL AND role = ?',
      [DEFAULT_ADMIN_EMAIL, 'super_admin']
    );

    if (existing.length > 0) {
      console.log('Super Admin user already exists:', DEFAULT_ADMIN_EMAIL);
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await conn.execute(
      `INSERT INTO users (society_id, name, email, password_hash, role) VALUES (NULL, ?, ?, ?, 'super_admin')`,
      [DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, passwordHash]
    );

    console.log('Super Admin created successfully.');
    console.log('  Email:', DEFAULT_ADMIN_EMAIL);
    console.log('  Password:', DEFAULT_ADMIN_PASSWORD);
    console.log('  (Change password after first login or set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME in .env)');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
