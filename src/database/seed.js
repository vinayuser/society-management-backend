/**
 * Single database seeder for the current schema (schema.sql).
 *
 * Usage (from backend folder, after npm run migrate):
 *   npm run seed
 *
 * Options / env:
 *   --no-locations     Skip countries/states/cities (faster; demo geo backfill will not work).
 *   --demo             Also load demo societies, users, flats, etc. (same as SEED_DEMO=1).
 *   SEED_DEMO=1        Same as --demo.
 *
 * Default: creates Super Admin (if missing), default society_plans (if empty), and full geo seed.
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'society_management',
};

const DEMO_PASSWORD = 'Demo@123';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function seedSuperAdmin(conn) {
  const email = process.env.ADMIN_EMAIL || 'admin@society.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const name = process.env.ADMIN_NAME || 'Super Admin';
  const [existing] = await conn.execute(
    'SELECT id FROM users WHERE email = ? AND society_id IS NULL AND role = ?',
    [email, 'super_admin']
  );
  if (existing.length > 0) {
    console.log('Super Admin already exists:', email);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await conn.execute(
    `INSERT INTO users (society_id, name, email, password_hash, role) VALUES (NULL, ?, ?, ?, 'super_admin')`,
    [name, email, passwordHash]
  );
  console.log('Super Admin created:', email, '(set ADMIN_EMAIL / ADMIN_PASSWORD in .env to customize)');
}

async function seedDefaultPlans(conn) {
  const [[{ n }]] = await conn.execute('SELECT COUNT(*) AS n FROM society_plans');
  if (n > 0) return;
  await conn.execute(`
    INSERT INTO society_plans (name, slug, billing_cycle, setup_fee, monthly_fee, yearly_fee, description) VALUES
    ('Basic', 'basic', 'monthly', 0, 2999, 35988, 'Essential features'),
    ('Standard', 'standard', 'monthly', 4999, 5999, 71988, 'Full features'),
    ('Premium', 'premium', 'quarterly', 9999, 7999, 95988, 'Premium + priority support')
  `);
  console.log('Seeded default society_plans (basic, standard, premium).');
}

async function seedLocations(conn) {
  let Country;
  let State;
  let City;
  try {
    const csc = require('country-state-city');
    Country = csc.Country;
    State = csc.State;
    City = csc.City;
  } catch (e) {
    console.error('country-state-city is required for geo seed. Install: npm install country-state-city');
    throw e;
  }

  const hashToUint32 = (str) => {
    const hex = crypto.createHash('sha1').update(String(str)).digest('hex');
    return parseInt(hex.slice(0, 8), 16) >>> 0;
  };

  const iso2Of = (c) => c.iso2 || c.isoCode || c.iso || c.iso_code;
  const iso2 = (c) => String(iso2Of(c) || '').trim().toUpperCase();

  const countries = Country.getAllCountries() || [];
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
        `INSERT INTO countries (iso2, name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [chunk]
      );
    }
  }

  const [countryRows] = await conn.execute('SELECT id, iso2 FROM countries WHERE is_active = 1');
  const countryMap = new Map(countryRows.map((r) => [String(r.iso2).toUpperCase(), r.id]));

  const stateChunkSize = 300;
  const cityChunkSize = 500;
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
        `INSERT INTO states (country_id, external_state_id, name, state_code) VALUES ?
         ON DUPLICATE KEY UPDATE name = VALUES(name), state_code = VALUES(state_code)`,
        [chunk]
      );
    }

    const [dbStates] = await conn.execute('SELECT id, external_state_id FROM states WHERE country_id = ?', [dbCountryId]);
    const stateMap = new Map(dbStates.map((r) => [Number(r.external_state_id), r.id]));

    for (const s of states) {
      const extStateId = hashToUint32(`${code}:${s.isoCode || ''}`);
      const stateDbId = stateMap.get(Number(extStateId));
      if (!stateDbId) continue;

      let cities = [];
      try {
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
          `INSERT INTO cities (state_id, external_city_id, name, city_code) VALUES ?
           ON DUPLICATE KEY UPDATE name = VALUES(name), city_code = VALUES(city_code)`,
          [chunk]
        );
      }
    }
  }
  console.log('Locations seed completed.');
}

async function seedDemo(conn) {
  const [existing] = await conn.execute(
    "SELECT id FROM societies WHERE alias IN ('demo-greenvalley', 'demo-sunrise') LIMIT 1"
  );
  if (existing.length > 0) {
    console.log('Demo data already present (demo-greenvalley / demo-sunrise). Skipping --demo.');
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [saCheck] = await conn.execute(
    "SELECT id FROM users WHERE role = 'super_admin' AND society_id IS NULL LIMIT 1"
  );
  if (saCheck.length === 0) {
    await conn.execute(
      `INSERT INTO users (society_id, name, email, password_hash, role) VALUES (NULL, 'Super Admin', 'admin@society.com', ?, 'super_admin')`,
      [await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10)]
    );
    console.log('Created Super Admin (admin@society.com) for demo.');
  }

  let plans = [];
  try {
    const [p] = await conn.execute('SELECT id, slug FROM society_plans ORDER BY id LIMIT 3');
    plans = p || [];
  } catch (_) {}
  const planBySlug = plans.reduce((acc, p) => ({ ...acc, [p.slug]: p.id }), {});
  const planId1 = planBySlug.standard ?? plans[0]?.id ?? null;

  const year = new Date().getFullYear();
  const thisMonth = new Date().getMonth() + 1;

  await conn.execute(
    `INSERT INTO societies (name, alias, email, phone, flat_count, plan_type, setup_fee, monthly_fee, billing_cycle, yearly_fee, status) VALUES
     ('Green Valley Apartments', 'demo-greenvalley', 'contact@greenvalley.demo', '+919876543210', 120, 'shared_app', 0, 5999, 'monthly', 71988, 'active'),
     ('Sunrise Residency', 'demo-sunrise', 'admin@sunrise.demo', '+919876543211', 80, 'shared_app', 4999, 2999, 'quarterly', 35988, 'active')`
  );
  const [socRows] = await conn.execute("SELECT id, name, alias FROM societies WHERE alias LIKE 'demo-%' ORDER BY id");
  const society1 = socRows[0];
  const society2 = socRows[1];
  console.log('Demo: created societies', society1.name, ',', society2.name);

  try {
    const [countryRows] = await conn.execute("SELECT id FROM countries WHERE iso2 = 'IN' LIMIT 1");
    if (countryRows.length) {
      const countryId = countryRows[0].id;
      const [stateRows] = await conn.execute(
        'SELECT id FROM states WHERE country_id = ? AND name = ? LIMIT 1',
        [countryId, 'Maharashtra']
      );
      if (stateRows.length) {
        const stateId = stateRows[0].id;
        const [cityMumbaiRows] = await conn.execute(
          'SELECT id FROM cities WHERE state_id = ? AND name = ? LIMIT 1',
          [stateId, 'Mumbai']
        );
        const [cityPuneRows] = await conn.execute(
          'SELECT id FROM cities WHERE state_id = ? AND name = ? LIMIT 1',
          [stateId, 'Pune']
        );
        if (cityMumbaiRows[0]?.id) {
          await conn.execute('UPDATE societies SET country_id = ?, state_id = ?, city_id = ? WHERE id = ?', [
            countryId,
            stateId,
            cityMumbaiRows[0].id,
            society1.id,
          ]);
        }
        if (cityPuneRows[0]?.id) {
          await conn.execute('UPDATE societies SET country_id = ?, state_id = ?, city_id = ? WHERE id = ?', [
            countryId,
            stateId,
            cityPuneRows[0].id,
            society2.id,
          ]);
        }
      }
    }
  } catch (e) {
    console.warn('Demo location backfill skipped:', e.message);
  }

  await conn.execute(
    `INSERT INTO society_config (society_id, logo, theme_color, address, banner_image, towers_blocks, total_flats, admin_contact_name, admin_contact_phone) VALUES
     (?, NULL, '#2563eb', 'Sector 5, Green Valley, Mumbai 400001', NULL, '["Tower A","Tower B","Tower C"]', 120, 'Ramesh Kumar', '+919876543210'),
     (?, NULL, '#059669', 'Sunrise Avenue, Pune 411001', NULL, '["Block 1","Block 2"]', 80, 'Priya Sharma', '+919876543211')`,
    [society1.id, society2.id]
  );

  await conn.execute(
    `INSERT INTO users (society_id, name, email, phone, password_hash, role) VALUES
     (?, 'Ramesh Kumar', 'admin@greenvalley.demo', '+919876543210', ?, 'society_admin'),
     (?, 'Priya Sharma', 'admin@sunrise.demo', '+919876543211', ?, 'society_admin'),
     (?, 'Amit Patel', 'amit@greenvalley.demo', '+919876543212', ?, 'resident'),
     (?, 'Sneha Reddy', 'sneha@greenvalley.demo', '+919876543213', ?, 'resident'),
     (?, 'Vikram Singh', 'vikram@sunrise.demo', '+919876543214', ?, 'resident')`,
    [society1.id, passwordHash, society2.id, passwordHash, society1.id, passwordHash, society1.id, passwordHash, society2.id, passwordHash]
  );
  const [userRows] = await conn.execute(
    "SELECT id, email, role, society_id FROM users WHERE email IN ('admin@greenvalley.demo','admin@sunrise.demo','amit@greenvalley.demo','sneha@greenvalley.demo','vikram@sunrise.demo') ORDER BY id"
  );
  const admin1 = userRows.find((u) => u.email === 'admin@greenvalley.demo');
  const admin2 = userRows.find((u) => u.email === 'admin@sunrise.demo');
  const resident1 = userRows.find((u) => u.email === 'amit@greenvalley.demo');
  const resident2 = userRows.find((u) => u.email === 'sneha@greenvalley.demo');
  const resident3 = userRows.find((u) => u.email === 'vikram@sunrise.demo');

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  await conn.execute(
    `INSERT INTO society_invites (society_name, email, phone, flat_count, plan_type, setup_fee, monthly_fee, billing_cycle, yearly_fee, address, invite_token, status, expires_at, society_id, plan_id) VALUES
     ('New Society Demo', 'new@demo.com', '+919999999999', 50, 'shared_app', 4999, 5999, 'monthly', 71988, 'Address for new society', 'demo-invite-pending-token-001', 'pending', ?, NULL, ?),
     ('Green Valley Apartments', 'contact@greenvalley.demo', '+919876543210', 120, 'shared_app', 0, 5999, 'monthly', 71988, 'Sector 5, Green Valley, Mumbai', 'demo-invite-accepted-token-002', 'accepted', ?, ?, ?)`,
    [expiresAt, planId1, expiresAt, society1.id, planId1]
  );

  try {
    const [countryRows] = await conn.execute("SELECT id FROM countries WHERE iso2 = 'IN' LIMIT 1");
    if (countryRows.length) {
      const countryId = countryRows[0].id;
      const [stateRows] = await conn.execute('SELECT id FROM states WHERE country_id = ? AND name = ? LIMIT 1', [
        countryId,
        'Maharashtra',
      ]);
      if (stateRows.length) {
        const stateId = stateRows[0].id;
        const [cityRows] = await conn.execute('SELECT id FROM cities WHERE state_id = ? AND name = ? LIMIT 1', [
          stateId,
          'Mumbai',
        ]);
        const cityId = cityRows[0]?.id;
        if (cityId) {
          await conn.execute(
            'UPDATE society_invites SET country_id = ?, state_id = ?, city_id = ? WHERE invite_token IN (?, ?)',
            [countryId, stateId, cityId, 'demo-invite-pending-token-001', 'demo-invite-accepted-token-002']
          );
        }
      }
    }
  } catch (e) {
    console.warn('Demo invite location backfill skipped:', e.message);
  }

  const due1 = `${year}-${String(thisMonth).padStart(2, '0')}-01`;
  const due2 = `${year}-${String(thisMonth + 1 > 12 ? 1 : thisMonth + 1).padStart(2, '0')}-01`;
  await conn.execute(
    `INSERT INTO billing (society_id, flat_id, amount, type, billing_date, due_date, payment_status, paid_at, invoice_number, notes, reminder_sent_at) VALUES
     (?, NULL, 5999, 'monthly', ?, ?, 'paid', NOW(), 'INV-DEMO-001', 'Monthly subscription', NULL),
     (?, NULL, 5999, 'monthly', ?, ?, 'pending', NULL, 'INV-DEMO-002', 'Monthly subscription', NULL),
     (?, NULL, 8997, 'quarterly', ?, ?, 'paid', NOW(), 'INV-DEMO-003', 'Q1 subscription', NULL)`,
    [society1.id, due1, due1, society1.id, due2, due2, society2.id, due1, due1]
  );

  const mo = MONTHS[thisMonth - 1];
  const nTitle1 = `New invoice: Green Valley Apartments — ${mo} ${year}`;
  const nBody1 = `Amount: ₹5,999. Due date: 1 ${mo} ${year}. View and pay in Dashboard → Invoices & Payments.`;
  const nTitle2 = `Payment reminder: Green Valley Apartments — ${mo} ${year}`;
  const nBody2 = `A payment reminder was sent for ${mo} ${year}. Please clear any pending invoices for "Green Valley Apartments".`;
  const nTitle3 = `New invoice: Sunrise Residency — Q1 ${year}`;
  const nBody3 = `Amount: ₹8,997. Due date: 1 Mar ${year}. View and pay in Dashboard → Invoices & Payments.`;

  await conn.execute(
    `INSERT INTO notifications (user_id, type, title, body, reference_id) VALUES (?, 'invoice_generated', ?, ?, NULL), (?, 'payment_reminder', ?, ?, NULL), (?, 'invoice_generated', ?, ?, NULL)`,
    [admin1.id, nTitle1, nBody1, admin1.id, nTitle2, nBody2, admin2.id, nTitle3, nBody3]
  );

  await conn.execute(
    `INSERT INTO flats (society_id, tower, flat_number, floor, flat_type, area_sqft, ownership_type, owner_name, owner_contact, owner_email, status) VALUES
     (?, 'Tower A', '101', 1, '3BHK', 1200, 'owner', 'Amit Patel', '+919876543212', 'amit@greenvalley.demo', 'active'),
     (?, 'Tower A', '102', 1, '2BHK', 900, 'tenant', 'Sneha Reddy', '+919876543213', 'sneha@greenvalley.demo', 'active'),
     (?, 'Tower B', '201', 2, '3BHK', 1250, 'owner', 'Other Owner', '+919999999998', NULL, 'active'),
     (?, 'Block 1', '101', 1, '2BHK', 950, 'owner', 'Vikram Singh', '+919876543214', 'vikram@sunrise.demo', 'active')`,
    [society1.id, society1.id, society1.id, society2.id]
  );
  const [flatRows] = await conn.execute(
    'SELECT id, society_id, tower, flat_number FROM flats WHERE society_id IN (?,?) ORDER BY society_id, id',
    [society1.id, society2.id]
  );
  const flat1 = flatRows[0];
  const flat2 = flatRows[1];
  const flat3 = flatRows[2];
  const flat4 = flatRows[3];

  await conn.execute(
    `INSERT INTO residents (society_id, user_id, flat_id, is_primary) VALUES (?,?,?,1), (?,?,?,1), (?,?,?,1)`,
    [society1.id, resident1.id, flat1.id, society1.id, resident2.id, flat2.id, society2.id, resident3.id, flat4.id]
  );

  await conn.execute(
    `INSERT INTO members (society_id, flat_id, user_id, name, phone, email, role, gender, status) VALUES
     (?, ?, ?, 'Amit Patel', '+919876543212', 'amit@greenvalley.demo', 'owner', 'male', 'active'),
     (?, ?, ?, 'Sneha Reddy', '+919876543213', 'sneha@greenvalley.demo', 'tenant', 'female', 'active'),
     (?, ?, ?, 'Vikram Singh', '+919876543214', 'vikram@sunrise.demo', 'owner', 'male', 'active')`,
    [society1.id, flat1.id, resident1.id, society1.id, flat2.id, resident2.id, society2.id, flat4.id, resident3.id]
  );
  const [memberRows] = await conn.execute('SELECT id, society_id, name FROM members WHERE society_id IN (?,?) ORDER BY id', [
    society1.id,
    society2.id,
  ]);
  const mem1 = memberRows[0];
  const mem2 = memberRows[1];
  const mem3 = memberRows[2];

  await conn.execute(
    `INSERT INTO member_family (society_id, member_id, name, relationship, phone, age) VALUES (?,?,'Anita Patel','spouse','+919876543215',35), (?,?,'Rahul Reddy','spouse','+919876543216',32)`,
    [society1.id, mem1.id, society1.id, mem2.id]
  );
  await conn.execute(
    `INSERT INTO member_emergency_contacts (society_id, member_id, contact_name, relationship, phone) VALUES (?,?,'Emergency Contact 1','brother','+919999999991'), (?,?,'Emergency Contact 2','sister','+919999999992')`,
    [society1.id, mem1.id, society2.id, mem3.id]
  );
  await conn.execute(
    `INSERT INTO member_vehicles (society_id, member_id, vehicle_number, vehicle_type, parking_slot) VALUES (?,?,'MH01AB1234','car','P-101'), (?,?,'MH02CD5678','bike','P-102')`,
    [society1.id, mem1.id, society2.id, mem3.id]
  );

  await conn.execute(
    `INSERT INTO guards (society_id, name, phone, email, employee_id, role, assigned_blocks, joining_date, is_active) VALUES
     (?, 'Rajesh Security', '+919876543220', 'guard1@greenvalley.demo', 'G001', 'guard', 'Tower A, Tower B', '2024-01-15', 1),
     (?, 'Suresh Watchman', '+919876543221', NULL, 'G002', 'guard', 'Block 1', '2024-02-01', 1)`,
    [society1.id, society2.id]
  );
  const [guardRows] = await conn.execute('SELECT id, society_id FROM guards WHERE society_id IN (?,?) ORDER BY id', [
    society1.id,
    society2.id,
  ]);
  const guard1 = guardRows[0];
  const guard2 = guardRows[1];
  const shiftStart = `${year}-${String(thisMonth).padStart(2, '0')}-01 08:00:00`;
  const shiftEnd = `${year}-${String(thisMonth).padStart(2, '0')}-01 20:00:00`;
  await conn.execute(
    `INSERT INTO guard_shifts (guard_id, society_id, shift_start, shift_end, assigned_gate) VALUES (?,?,?,?,'Main Gate'), (?,?,?,?,'Gate 2')`,
    [guard1.id, society1.id, shiftStart, shiftEnd, guard2.id, society2.id, shiftStart, shiftEnd]
  );
  await conn.execute(
    `INSERT INTO guard_leaves (guard_id, society_id, leave_type, start_date, end_date, status) VALUES (?,?,'casual',?,?,'approved')`,
    [guard1.id, society1.id, `${year}-03-20`, `${year}-03-21`]
  );

  await conn.execute(
    `INSERT INTO visitors (society_id, flat_id, visitor_name, visitor_phone, purpose, entry_time, visitor_type, logged_by_user_id) VALUES
     (?, ?, 'Guest Visitor', '+919998887766', 'Personal visit', NOW() - INTERVAL 2 HOUR, 'guest', ?),
     (?, ?, 'Delivery Person', '+919997776655', 'Package delivery', NOW() - INTERVAL 1 HOUR, 'delivery', ?)`,
    [society1.id, flat1.id, resident1.id, society2.id, flat4.id, resident3.id]
  );

  await conn.execute(
    `INSERT INTO complaints (society_id, user_id, title, description, category, status) VALUES
     (?, ?, 'Water leakage in corridor', 'Leak near Tower A lift lobby since morning.', 'maintenance', 'open'),
     (?, ?, 'Parking dispute', 'Vehicle parked in wrong slot repeatedly.', 'parking', 'in_progress')`,
    [society1.id, resident1.id, society2.id, resident3.id]
  );

  await conn.execute(
    `INSERT INTO notices (society_id, title, message, published_at, created_by) VALUES
     (?, 'Annual General Meeting', 'AGM scheduled for next month. All residents are requested to attend.', NOW(), ?),
     (?, 'Maintenance holiday', 'Society office closed on 2nd Saturday. Emergency contact: security.', NOW(), ?)`,
    [society1.id, admin1.id, society2.id, admin2.id]
  );

  await conn.execute(
    `INSERT INTO vendors (society_id, vendor_name, category, phone, description, service_area, status) VALUES
     (?, 'Quick Plumbers', 'plumbing', '+919876500001', '24x7 plumbing repair', 'Local', 'active'),
     (?, 'Safe Electricians', 'electrical', '+919876500002', 'Licensed electricians', 'City', 'active')`,
    [society1.id, society2.id]
  );

  await conn.execute(
    `INSERT INTO deliveries (society_id, flat_id, delivery_type, status, received_at) VALUES
     (?, ?, 'courier', 'collected', NOW() - INTERVAL 1 DAY),
     (?, ?, 'food', 'notified', NOW())`,
    [society1.id, flat1.id, society2.id, flat4.id]
  );

  await conn.execute(
    `INSERT INTO marketplace_items (society_id, user_id, title, description, price, status) VALUES
     (?, ?, 'Sofa set (3+2)', 'Good condition, 2 years old', 15000, 'active'),
     (?, ?, 'Bookshelf', 'Wooden, 4 shelf', 2500, 'active')`,
    [society1.id, resident1.id, society2.id, resident3.id]
  );

  await conn.execute(
    `INSERT INTO lost_found (society_id, user_id, title, description, status) VALUES
     (?, ?, 'Keys found near Tower A', 'Set of 3 keys with keychain', 'open'),
     (?, ?, 'Wallet found in lobby', 'Brown leather wallet', 'closed')`,
    [society1.id, resident2.id, society2.id, resident3.id]
  );

  const [pollIns] = await conn.execute(
    `INSERT INTO polls (society_id, title, description, created_by) VALUES (?, 'Best time for gym', 'When should society gym be open?', ?)`,
    [society1.id, admin1.id]
  );
  const pollId = pollIns.insertId;
  await conn.execute(
    `INSERT INTO poll_options (poll_id, option_label, sort_order) VALUES (?, '6 AM - 9 AM', 0), (?, '5 PM - 8 PM', 1), (?, 'Both', 2)`,
    [pollId, pollId, pollId]
  );
  const [optRows] = await conn.execute('SELECT id FROM poll_options WHERE poll_id = ? ORDER BY sort_order', [pollId]);
  await conn.execute(`INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?), (?, ?, ?)`, [
    pollId,
    resident1.id,
    optRows[0].id,
    pollId,
    resident2.id,
    optRows[1].id,
  ]);

  const [grpIns] = await conn.execute(
    `INSERT INTO chat_groups (society_id, name, description, created_by) VALUES (?, 'General', 'Society general chat', ?)`,
    [society1.id, admin1.id]
  );
  const groupId = grpIns.insertId;
  await conn.execute(`INSERT INTO chat_group_members (group_id, user_id) VALUES (?,?), (?,?), (?,?)`, [
    groupId,
    admin1.id,
    groupId,
    resident1.id,
    groupId,
    resident2.id,
  ]);
  await conn.execute(
    `INSERT INTO chat_messages (group_id, society_id, user_id, message_text, message_type) VALUES (?,?,?,'Welcome to Green Valley chat!','text'), (?,?,?,'Thanks, admin.','text')`,
    [groupId, society1.id, admin1.id, groupId, society1.id, resident1.id]
  );

  const startDate = `${year}-${String(thisMonth).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(thisMonth + 2 > 12 ? thisMonth + 2 - 12 : thisMonth + 2).padStart(2, '0')}-28`;
  await conn.execute(
    `INSERT INTO ads (society_id, type, content_url, title, start_date, end_date, is_active) VALUES
     (NULL, 'banner', 'https://example.com/banner1.jpg', 'Festival offer', ?, ?, 1),
     (NULL, 'promotion', 'https://example.com/promo1.jpg', 'Maintenance tips', ?, ?, 1)`,
    [startDate, endDate, startDate, endDate]
  );

  const reqPasswordHash = await bcrypt.hash('Request@123', 10);
  await conn.execute(
    `INSERT INTO resident_signup_requests (society_id, name, email, phone, tower, flat_number, password_hash, status) VALUES
     (?, 'New Resident', 'newresident@demo.com', '+919988877766', 'Tower C', '301', ?, 'pending'),
     (?, 'Another Resident', 'another@demo.com', '+919988877765', 'Block 2', '201', ?, 'approved')`,
    [society1.id, reqPasswordHash, society2.id, reqPasswordHash]
  );

  // Member billing rows linked to flats (for resident app "My dues")
  await conn.execute(
    `INSERT INTO billing (society_id, flat_id, amount, type, billing_date, due_date, payment_status, invoice_number, notes) VALUES
     (?, ?, 3500, 'monthly', ?, ?, 'pending', 'INV-FLAT-A101', 'Maintenance — Tower A-101'),
     (?, ?, 3500, 'monthly', ?, ?, 'paid', 'INV-FLAT-A102', 'Maintenance — Tower A-102')`,
    [society1.id, flat1.id, due1, due1, society1.id, flat2.id, due1, due1]
  );

  console.log('\n--- Demo seed complete ---');
  console.log('Society admins: admin@greenvalley.demo / admin@sunrise.demo — password:', DEMO_PASSWORD);
  console.log('Residents: amit@greenvalley.demo, sneha@greenvalley.demo, vikram@sunrise.demo — password:', DEMO_PASSWORD);
}

async function main() {
  const wantDemo = process.env.SEED_DEMO === '1' || process.argv.includes('--demo');
  const skipLocations = process.argv.includes('--no-locations');

  let conn;
  try {
    conn = await mysql.createConnection(config);
    await seedSuperAdmin(conn);
    await seedDefaultPlans(conn);
    if (!skipLocations) {
      await seedLocations(conn);
    } else {
      console.log('Skipped locations (--no-locations).');
    }
    if (wantDemo) {
      await seedDemo(conn);
    } else {
      console.log('Tip: run with --demo or SEED_DEMO=1 to load Green Valley / Sunrise demo data.');
    }
    console.log('\nSeed finished.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    if (err.sql) console.error('SQL:', err.sql);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
