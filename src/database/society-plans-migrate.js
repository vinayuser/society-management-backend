/**
 * Society plans table + plan_id on society_invites.
 * Run: node src/database/society-plans-migrate.js
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS society_plans (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        slug VARCHAR(64) NOT NULL UNIQUE,
        billing_cycle VARCHAR(16) NOT NULL DEFAULT 'monthly',
        setup_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        monthly_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        yearly_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        description TEXT DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_active (is_active)
      )
    `);
    console.log('society_plans table ready');

    const [inviteCols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'society_invites'`,
      [db]
    );
    const inviteNames = inviteCols.map((c) => c.COLUMN_NAME);
    if (!inviteNames.includes('plan_id')) {
      await conn.query(
        `ALTER TABLE society_invites ADD COLUMN plan_id INT UNSIGNED DEFAULT NULL AFTER plan_type,
         ADD INDEX idx_plan_id (plan_id)`
      );
      console.log('Added society_invites.plan_id');
    }

    const [planCount] = await conn.query('SELECT COUNT(*) as c FROM society_plans');
    if (planCount[0].c === 0) {
      await conn.query(`
        INSERT INTO society_plans (name, slug, billing_cycle, setup_fee, monthly_fee, yearly_fee, description) VALUES
        ('Basic', 'basic', 'monthly', 0, 2999, 35988, 'Essential features'),
        ('Standard', 'standard', 'monthly', 4999, 5999, 71988, 'Full features'),
        ('Premium', 'premium', 'quarterly', 9999, 7999, 95988, 'Premium + priority support')
      `);
      console.log('Seeded default plans');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
