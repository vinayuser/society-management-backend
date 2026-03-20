/**
 * Seed countries/states/cities into MySQL.
 *
 * Run:
 *   node src/database/seed-locations.js
 *
 * Notes:
 * - Requires dependency: `country-state-city`
 * - Uses upserts (based on unique keys) so it can be re-run.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'society_management',
};

async function run() {
  let Country;
  let State;
  let City;

  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const csc = require('country-state-city');
    Country = csc.Country;
    State = csc.State;
    City = csc.City;
  } catch (e) {
    console.error('Missing dependency: country-state-city');
    console.error('Run: npm install country-state-city');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection(config);

    const hashToUint32 = (str) => {
      const s = String(str);
      const hex = crypto.createHash('sha1').update(s).digest('hex');
      // 32-bit unsigned range
      return parseInt(hex.slice(0, 8), 16) >>> 0;
    };

    // ---- Countries upsert ----
    const countries = Country.getAllCountries() || [];

    const iso2Of = (c) => c.iso2 || c.isoCode || c.iso || c.iso_code;
    const iso2 = (c) => String(iso2Of(c) || '').trim().toUpperCase();

    const countryValues = [];
    for (const c of countries) {
      const code = iso2(c);
      if (!code) continue;
      countryValues.push([code, c.name]);
    }

    if (countryValues.length) {
      const chunkSize = 200;
      for (let i = 0; i < countryValues.length; i += chunkSize) {
        const chunk = countryValues.slice(i, i + chunkSize);
        await conn.query(
          `INSERT INTO countries (iso2, name)
           VALUES ?
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [chunk]
        );
      }
    }

    const [countryRows] = await conn.execute(`SELECT id, iso2 FROM countries WHERE is_active = 1`);
    const countryMap = new Map(countryRows.map((r) => [String(r.iso2).toUpperCase(), r.id]));

    // ---- States + Cities ----
    const stateChunkSize = 300;
    const cityChunkSize = 500;

    const pinnedRankDefaults = null;

    const allCountries = Country.getAllCountries() || [];
    for (let ci = 0; ci < allCountries.length; ci++) {
      const c = allCountries[ci];
      const code = iso2(c);
      if (!code) continue;
      const dbCountryId = countryMap.get(code);
      if (!dbCountryId) continue;

      console.log(`Seeding states/cities for ${code} (${c.name})...`);

      const states = State.getStatesOfCountry(code) || [];
      const stateValues = states.map((s) => [
        dbCountryId,
        hashToUint32(`${code}:${s.isoCode || ''}`),
        s.name,
        s.isoCode || null,
      ]);

      for (let i = 0; i < stateValues.length; i += stateChunkSize) {
        const chunk = stateValues.slice(i, i + stateChunkSize);
        await conn.query(
          `INSERT INTO states (country_id, external_state_id, name, state_code)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             state_code = VALUES(state_code)`,
          [chunk]
        );
      }

      // Map external_state_id => db state id for this country
      const [dbStates] = await conn.execute(
        `SELECT id, external_state_id
         FROM states
         WHERE country_id = ?`,
        [dbCountryId]
      );
      const stateMap = new Map(dbStates.map((r) => [Number(r.external_state_id), r.id]));

      // Cities per state
      for (const s of states) {
        const extStateId = hashToUint32(`${code}:${s.isoCode || ''}`);
        const stateDbId = stateMap.get(Number(extStateId));
        if (!stateDbId) continue;

        let cities = [];
        try {
          // Signature: getCitiesOfState(countryCode, stateCode)
          const stateCode = s.isoCode || s.stateCode;
          cities = City.getCitiesOfState(code, stateCode) || [];
        } catch (_) {
          cities = [];
        }

        if (!cities.length) continue;

        const cityValues = cities.map((ct) => {
          const lat = ct.latitude;
          const lng = ct.longitude;
          const extCityId = hashToUint32(`${code}:${s.isoCode || ''}:${ct.name}:${lat}:${lng}`);
          return [stateDbId, extCityId, ct.name, null];
        });
        for (let i = 0; i < cityValues.length; i += cityChunkSize) {
          const chunk = cityValues.slice(i, i + cityChunkSize);
          await conn.query(
            `INSERT INTO cities (state_id, external_city_id, name, city_code)
             VALUES ?
             ON DUPLICATE KEY UPDATE
               name = VALUES(name),
               city_code = VALUES(city_code)`,
            [chunk]
          );
        }
      }
    }

    console.log('Locations seed completed successfully.');
  } catch (err) {
    console.error('Seed-locations failed:', err.message);
    if (err.sql) console.error('SQL:', err.sql);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();

