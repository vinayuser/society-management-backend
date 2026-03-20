/**
 * Full demo seeder: populates the database with sample data for all modules
 * so app developers can build and test against realistic data.
 *
 * Run after migrations: node src/database/seed-demo.js (from backend folder)
 * Requires: Super Admin user (run seed.js first if needed).
 *
 * Creates: societies, society_config, users (society_admin + residents), society_invites,
 * billing, notifications, flats, residents, members (+ family, emergency, vehicles),
 * guards (+ shifts, leaves), visitors, complaints, notices, vendors, deliveries,
 * marketplace_items, lost_found, polls + options + votes, chat_groups + messages,
 * ads, resident_signup_requests.
 */
const path = require('path');
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

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection(config);

    const [existing] = await conn.execute(
      "SELECT id FROM societies WHERE alias IN ('demo-greenvalley', 'demo-sunrise') LIMIT 1"
    );
    if (existing.length > 0) {
      console.log('Demo data already exists (societies with demo aliases found). Skip or delete them first.');
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // Ensure super_admin exists for reference
    let [superAdmin] = await conn.execute(
      "SELECT id FROM users WHERE role = 'super_admin' AND society_id IS NULL LIMIT 1"
    );
    if (superAdmin.length === 0) {
      await conn.execute(
        `INSERT INTO users (society_id, name, email, password_hash, role) VALUES (NULL, 'Super Admin', 'admin@society.com', ?, 'super_admin')`,
        [await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10)]
      );
      [superAdmin] = await conn.execute("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
      console.log('Created Super Admin (admin@society.com).');
    }
    // Get plan ids (from society-plans migration seed; run migrations first)
    let plans = [];
    try {
      const [p] = await conn.execute('SELECT id, slug FROM society_plans ORDER BY id LIMIT 3');
      plans = p || [];
    } catch (_) {}
    const planById = plans.reduce((acc, p) => ({ ...acc, [p.slug]: p.id }), {});
    const planId1 = planById.standard ?? plans[0]?.id ?? null;

    const year = new Date().getFullYear();
    const thisMonth = new Date().getMonth() + 1;

    // --- Societies ---
    await conn.execute(
      `INSERT INTO societies (name, alias, email, phone, flat_count, plan_type, setup_fee, monthly_fee, billing_cycle, yearly_fee, status) VALUES
       ('Green Valley Apartments', 'demo-greenvalley', 'contact@greenvalley.demo', '+919876543210', 120, 'shared_app', 0, 5999, 'monthly', 71988, 'active'),
       ('Sunrise Residency', 'demo-sunrise', 'admin@sunrise.demo', '+919876543211', 80, 'shared_app', 4999, 2999, 'quarterly', 35988, 'active')`
    );
    const [socRows] = await conn.execute("SELECT id, name, alias FROM societies WHERE alias LIKE 'demo-%' ORDER BY id");
    const society1 = socRows[0];
    const society2 = socRows[1];
    console.log('Created 2 societies:', society1.name, ',', society2.name);

    // --- Location backfill for demo societies (best-effort) ---
    // Requires: countries/states/cities tables already seeded via `npm run seed:locations`.
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
          const cityMumbaiId = cityMumbaiRows[0]?.id;
          const cityPuneId = cityPuneRows[0]?.id;

          if (cityMumbaiId) {
            await conn.execute('UPDATE societies SET country_id = ?, state_id = ?, city_id = ? WHERE id = ?', [countryId, stateId, cityMumbaiId, society1.id]);
          }
          if (cityPuneId) {
            await conn.execute('UPDATE societies SET country_id = ?, state_id = ?, city_id = ? WHERE id = ?', [countryId, stateId, cityPuneId, society2.id]);
          }
        }
      }
    } catch (e) {
      console.warn('Location backfill skipped:', e.message);
    }

    // --- Society config ---
    await conn.execute(
      `INSERT INTO society_config (society_id, logo, theme_color, address, banner_image, towers_blocks, total_flats, admin_contact_name, admin_contact_phone) VALUES
       (?, NULL, '#2563eb', 'Sector 5, Green Valley, Mumbai 400001', NULL, '["Tower A","Tower B","Tower C"]', 120, 'Ramesh Kumar', '+919876543210'),
       (?, NULL, '#059669', 'Sunrise Avenue, Pune 411001', NULL, '["Block 1","Block 2"]', 80, 'Priya Sharma', '+919876543211')`,
      [society1.id, society2.id]
    );

    // --- Users: society_admin + residents ---
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
    console.log('Created society admins and residents.');

    // --- Society invites (pending + accepted) ---
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(
      `INSERT INTO society_invites (society_name, email, phone, flat_count, plan_type, setup_fee, monthly_fee, billing_cycle, yearly_fee, address, invite_token, status, expires_at, society_id, plan_id) VALUES
       ('New Society Demo', 'new@demo.com', '+919999999999', 50, 'shared_app', 4999, 5999, 'monthly', 71988, 'Address for new society', 'demo-invite-pending-token-001', 'pending', ?, NULL, ?),
       ('Green Valley Apartments', 'contact@greenvalley.demo', '+919876543210', 120, 'shared_app', 0, 5999, 'monthly', 71988, 'Sector 5, Green Valley, Mumbai', 'demo-invite-accepted-token-002', 'accepted', ?, ?, ?)`,
      [expiresAt, planId1, expiresAt, society1.id, planId1]
    );
    console.log('Created society invites (pending + accepted).');

    // --- Location backfill for demo invites (best-effort) ---
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
      console.warn('Invite location backfill skipped:', e.message);
    }

    // --- Billing (mix of paid and pending) ---
    const due1 = `${year}-${String(thisMonth).padStart(2, '0')}-01`;
    const due2 = `${year}-${String(thisMonth + 1 > 12 ? 1 : thisMonth + 1).padStart(2, '0')}-01`;
    await conn.execute(
      `INSERT INTO billing (society_id, amount, type, billing_date, due_date, payment_status, paid_at, invoice_number, notes, reminder_sent_at) VALUES
       (?, 5999, 'monthly', ?, ?, 'paid', NOW(), 'INV-DEMO-001', 'Monthly subscription', NULL),
       (?, 5999, 'monthly', ?, ?, 'pending', NULL, 'INV-DEMO-002', 'Monthly subscription', NULL),
       (?, 8997, 'quarterly', ?, ?, 'paid', NOW(), 'INV-DEMO-003', 'Q1 subscription', NULL)`,
      [society1.id, due1, due1, society1.id, due2, due2, society2.id, due1, due1]
    );
    console.log('Created billing records (paid + pending).');

    // --- Notifications for society admins ---
    await conn.execute(
      `INSERT INTO notifications (user_id, type, title, body, reference_id) VALUES
       (?, 'invoice_generated', 'New invoice: Green Valley Apartments — ${MONTHS[thisMonth - 1]} ${year}', 'Amount: ₹5,999. Due date: 1 ${MONTHS[thisMonth - 1]} ${year}. View and pay in Dashboard → Invoices & Payments.', NULL),
       (?, 'payment_reminder', 'Payment reminder: Green Valley Apartments — ${MONTHS[thisMonth - 1]} ${year}', 'A payment reminder was sent for ${MONTHS[thisMonth - 1]} ${year}. Please clear any pending invoices for "Green Valley Apartments" in Dashboard → Invoices & Payments.', NULL),
       (?, 'invoice_generated', 'New invoice: Sunrise Residency — Q1 ${year}', 'Amount: ₹8,997. Due date: 1 Mar ${year}. View and pay in Dashboard → Invoices & Payments.', NULL)`,
      [admin1.id, admin1.id, admin2.id]
    );
    console.log('Created notifications for society admins.');

    // --- Flats ---
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
    console.log('Created flats.');

    // --- Residents (user-flat link) ---
    await conn.execute(
      `INSERT INTO residents (society_id, user_id, flat_id, is_primary) VALUES (?,?,?,1), (?,?,?,1), (?,?,?,1)`,
      [society1.id, resident1.id, flat1.id, society1.id, resident2.id, flat2.id, society2.id, resident3.id, flat4.id]
    );
    console.log('Created residents.');

    // --- Members (detailed member records) ---
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
    console.log('Created members, family, emergency contacts, vehicles.');

    // --- Guards ---
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
      `INSERT INTO guard_leaves (guard_id, society_id, leave_type, start_date, end_date, status) VALUES (?,?,'casual','${year}-03-20','${year}-03-21','approved')`,
      [guard1.id, society1.id]
    );
    console.log('Created guards, shifts, leaves.');

    // --- Visitors ---
    await conn.execute(
      `INSERT INTO visitors (society_id, flat_id, visitor_name, visitor_phone, purpose, entry_time, visitor_type, logged_by_user_id) VALUES
       (?, ?, 'Guest Visitor', '+919998887766', 'Personal visit', NOW() - INTERVAL 2 HOUR, 'guest', ?),
       (?, ?, 'Delivery Person', '+919997776655', 'Package delivery', NOW() - INTERVAL 1 HOUR, 'delivery', ?)`,
      [society1.id, flat1.id, resident1.id, society2.id, flat4.id, resident3.id]
    );
    console.log('Created visitors.');

    // --- Complaints ---
    await conn.execute(
      `INSERT INTO complaints (society_id, user_id, title, description, category, status) VALUES
       (?, ?, 'Water leakage in corridor', 'Leak near Tower A lift lobby since morning.', 'maintenance', 'open'),
       (?, ?, 'Parking dispute', 'Vehicle parked in wrong slot repeatedly.', 'parking', 'in_progress')`,
      [society1.id, resident1.id, society2.id, resident3.id]
    );
    console.log('Created complaints.');

    // --- Notices ---
    await conn.execute(
      `INSERT INTO notices (society_id, title, message, published_at, created_by) VALUES
       (?, 'Annual General Meeting', 'AGM scheduled for next month. All residents are requested to attend.', NOW(), ?),
       (?, 'Maintenance holiday', 'Society office closed on 2nd Saturday. Emergency contact: security.', NOW(), ?)`,
      [society1.id, admin1.id, society2.id, admin2.id]
    );
    console.log('Created notices.');

    // --- Vendors ---
    await conn.execute(
      `INSERT INTO vendors (society_id, vendor_name, category, phone, description, service_area, status) VALUES
       (?, 'Quick Plumbers', 'plumbing', '+919876500001', '24x7 plumbing repair', 'Local', 'active'),
       (?, 'Safe Electricians', 'electrical', '+919876500002', 'Licensed electricians', 'City', 'active')`,
      [society1.id, society2.id]
    );
    console.log('Created vendors.');

    // --- Deliveries ---
    await conn.execute(
      `INSERT INTO deliveries (society_id, flat_id, delivery_type, status, received_at) VALUES
       (?, ?, 'courier', 'collected', NOW() - INTERVAL 1 DAY),
       (?, ?, 'food', 'notified', NOW())`,
      [society1.id, flat1.id, society2.id, flat4.id]
    );
    console.log('Created deliveries.');

    // --- Marketplace ---
    await conn.execute(
      `INSERT INTO marketplace_items (society_id, user_id, title, description, price, status) VALUES
       (?, ?, 'Sofa set (3+2)', 'Good condition, 2 years old', 15000, 'active'),
       (?, ?, 'Bookshelf', 'Wooden, 4 shelf', 2500, 'active')`,
      [society1.id, resident1.id, society2.id, resident3.id]
    );
    console.log('Created marketplace items.');

    // --- Lost & Found ---
    await conn.execute(
      `INSERT INTO lost_found (society_id, user_id, title, description, status) VALUES
       (?, ?, 'Keys found near Tower A', 'Set of 3 keys with keychain', 'open'),
       (?, ?, 'Wallet found in lobby', 'Brown leather wallet', 'closed')`,
      [society1.id, resident2.id, society2.id, resident3.id]
    );
    console.log('Created lost & found.');

    // --- Polls ---
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
    await conn.execute(
      `INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?), (?, ?, ?)`,
      [pollId, resident1.id, optRows[0].id, pollId, resident2.id, optRows[1].id]
    );
    console.log('Created poll with options and votes.');

    // --- Chat ---
    const [grpIns] = await conn.execute(
      `INSERT INTO chat_groups (society_id, name, description, created_by) VALUES (?, 'General', 'Society general chat', ?)`,
      [society1.id, admin1.id]
    );
    const groupId = grpIns.insertId;
    await conn.execute(
      `INSERT INTO chat_group_members (group_id, user_id) VALUES (?,?), (?,?), (?,?)`,
      [groupId, admin1.id, groupId, resident1.id, groupId, resident2.id]
    );
    await conn.execute(
      `INSERT INTO chat_messages (group_id, society_id, user_id, message_text, message_type) VALUES (?,?,?,'Welcome to Green Valley chat!','text'), (?,?,?,'Thanks, admin.','text')`,
      [groupId, society1.id, admin1.id, groupId, society1.id, resident1.id]
    );
    console.log('Created chat group and messages.');

    // --- Ads ---
    const startDate = `${year}-${String(thisMonth).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(thisMonth + 2 > 12 ? thisMonth + 2 - 12 : thisMonth + 2).padStart(2, '0')}-28`;
    await conn.execute(
      `INSERT INTO ads (society_id, type, content_url, title, start_date, end_date, is_active) VALUES
       (?, 'banner', 'https://example.com/banner1.jpg', 'Festival offer', ?, ?, 1),
       (?, 'promotion', 'https://example.com/promo1.jpg', 'Maintenance tips', ?, ?, 1)`,
      [society1.id, startDate, endDate, society2.id, startDate, endDate]
    );
    console.log('Created ads.');

    // --- Resident signup requests ---
    const reqPasswordHash = await bcrypt.hash('Request@123', 10);
    await conn.execute(
      `INSERT INTO resident_signup_requests (society_id, name, email, phone, tower, flat_number, password_hash, status) VALUES
       (?, 'New Resident', 'newresident@demo.com', '+919988877766', 'Tower C', '301', ?, 'pending'),
       (?, 'Another Resident', 'another@demo.com', '+919988877765', 'Block 2', '201', ?, 'approved')`,
      [society1.id, reqPasswordHash, society2.id, reqPasswordHash]
    );
    console.log('Created resident signup requests.');

    console.log('\n--- Demo seed complete ---');
    console.log('Societies: Green Valley (demo-greenvalley), Sunrise (demo-sunrise)');
    console.log('Society Admin logins: admin@greenvalley.demo / admin@sunrise.demo — Password:', DEMO_PASSWORD);
    console.log('Resident logins: amit@greenvalley.demo, sneha@greenvalley.demo, vikram@sunrise.demo — Password:', DEMO_PASSWORD);
  } catch (err) {
    console.error('Seed failed:', err.message);
    if (err.sql) console.error('SQL:', err.sql);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
