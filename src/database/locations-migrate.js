/**
 * Countries / States / Cities schema + columns migration.
 *
 * Run:
 *   node src/database/locations-migrate.js
 *
 * Creates:
 *   - countries
 *   - states (with pinned support for super-admin)
 *   - cities
 *
 * Adds columns:
 *   - societies: country_id/state_id/city_id
 *   - society_invites: country_id/state_id/city_id
 *   - society_config: country_id/state_id/city_id
 *   - resident_signup_requests: country_id/state_id/city_id
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'society_management',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
};

async function hasColumn(conn, tableName, columnName) {
  const db = config.database;
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [db, tableName, columnName]
  );
  return rows.length > 0;
}

async function hasTable(conn, tableName) {
  const db = config.database;
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?`,
    [db, tableName]
  );
  return rows.length > 0;
}

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection(config);

    // ---- Geo base tables ----
    if (!(await hasTable(conn, 'countries'))) {
      await conn.query(`
        CREATE TABLE countries (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          iso2 CHAR(2) NOT NULL UNIQUE,
          name VARCHAR(128) NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('Created countries table');
    }

    if (!(await hasTable(conn, 'states'))) {
      await conn.query(`
        CREATE TABLE states (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          country_id INT UNSIGNED NOT NULL,
          external_state_id INT UNSIGNED NOT NULL,
          name VARCHAR(128) NOT NULL,
          state_code VARCHAR(32) DEFAULT NULL,
          is_pinned TINYINT(1) NOT NULL DEFAULT 0,
          pinned_rank INT UNSIGNED DEFAULT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_state_external (country_id, external_state_id),
          INDEX idx_state_country (country_id),
          INDEX idx_state_pinned (is_pinned, pinned_rank),
          FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
        )
      `);
      console.log('Created states table');
    }

    if (!(await hasTable(conn, 'cities'))) {
      await conn.query(`
        CREATE TABLE cities (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          state_id INT UNSIGNED NOT NULL,
          external_city_id INT UNSIGNED NOT NULL,
          name VARCHAR(128) NOT NULL,
          city_code VARCHAR(32) DEFAULT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_city_external (state_id, external_city_id),
          INDEX idx_city_state (state_id),
          INDEX idx_city_name (name),
          FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE
        )
      `);
      console.log('Created cities table');
    }

    // ---- Add location columns to existing tables ----
    // societies
    if (await hasTable(conn, 'societies')) {
      if (!(await hasColumn(conn, 'societies', 'country_id'))) {
        await conn.query(`ALTER TABLE societies ADD COLUMN country_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_societies_country (country_id)`);
      }
      if (!(await hasColumn(conn, 'societies', 'state_id'))) {
        await conn.query(`ALTER TABLE societies ADD COLUMN state_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_societies_state (state_id)`);
      }
      if (!(await hasColumn(conn, 'societies', 'city_id'))) {
        await conn.query(`ALTER TABLE societies ADD COLUMN city_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_societies_city (city_id)`);
      }
    }

    // society_invites
    if (await hasTable(conn, 'society_invites')) {
      if (!(await hasColumn(conn, 'society_invites', 'country_id'))) {
        await conn.query(`ALTER TABLE society_invites ADD COLUMN country_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_invites_country (country_id)`);
      }
      if (!(await hasColumn(conn, 'society_invites', 'state_id'))) {
        await conn.query(`ALTER TABLE society_invites ADD COLUMN state_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_invites_state (state_id)`);
      }
      if (!(await hasColumn(conn, 'society_invites', 'city_id'))) {
        await conn.query(`ALTER TABLE society_invites ADD COLUMN city_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_invites_city (city_id)`);
      }
    }

    // society_config
    if (await hasTable(conn, 'society_config')) {
      if (!(await hasColumn(conn, 'society_config', 'country_id'))) {
        await conn.query(`ALTER TABLE society_config ADD COLUMN country_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_config_country (country_id)`);
      }
      if (!(await hasColumn(conn, 'society_config', 'state_id'))) {
        await conn.query(`ALTER TABLE society_config ADD COLUMN state_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_config_state (state_id)`);
      }
      if (!(await hasColumn(conn, 'society_config', 'city_id'))) {
        await conn.query(`ALTER TABLE society_config ADD COLUMN city_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_config_city (city_id)`);
      }
    }

    // resident_signup_requests
    if (await hasTable(conn, 'resident_signup_requests')) {
      if (!(await hasColumn(conn, 'resident_signup_requests', 'country_id'))) {
        await conn.query(`ALTER TABLE resident_signup_requests ADD COLUMN country_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_signup_country (country_id)`);
      }
      if (!(await hasColumn(conn, 'resident_signup_requests', 'state_id'))) {
        await conn.query(`ALTER TABLE resident_signup_requests ADD COLUMN state_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_signup_state (state_id)`);
      }
      if (!(await hasColumn(conn, 'resident_signup_requests', 'city_id'))) {
        await conn.query(`ALTER TABLE resident_signup_requests ADD COLUMN city_id INT UNSIGNED DEFAULT NULL, ADD INDEX idx_signup_city (city_id)`);
      }
    }

    console.log('Locations migration completed successfully.');
  } catch (err) {
    console.error('Locations migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();

