const db = require('../config/database');

async function listCountries() {
  const [rows] = await db.pool.execute('SELECT id, iso2, name FROM countries WHERE is_active = 1 ORDER BY name ASC');
  return rows;
}

async function listStates(countryId) {
  const [rows] = await db.pool.execute(
    `SELECT id, name, state_code, is_pinned, pinned_rank
     FROM states
     WHERE country_id = ? AND is_active = 1
     ORDER BY
       is_pinned DESC,
       (pinned_rank IS NULL) ASC,
       pinned_rank ASC,
       name ASC`,
    [countryId]
  );
  return rows;
}

async function listCities(stateId) {
  const [rows] = await db.pool.execute(
    `SELECT id, name, city_code
     FROM cities
     WHERE state_id = ? AND is_active = 1
     ORDER BY name ASC`,
    [stateId]
  );
  return rows;
}

async function pinState(stateId, { isPinned, pinnedRank }) {
  if (isPinned) {
    const rank = pinnedRank != null ? Number(pinnedRank) : 1;
    await db.pool.execute('UPDATE states SET is_pinned = 1, pinned_rank = ? WHERE id = ?', [rank, stateId]);
  } else {
    await db.pool.execute('UPDATE states SET is_pinned = 0, pinned_rank = NULL WHERE id = ?', [stateId]);
  }

  const [rows] = await db.pool.execute(
    'SELECT id, name, state_code, country_id, is_pinned, pinned_rank FROM states WHERE id = ?',
    [stateId]
  );
  if (!rows.length) return null;
  return rows[0];
}

module.exports = { listCountries, listStates, listCities, pinState };

