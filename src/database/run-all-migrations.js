/**
 * Run all migrations in order: schema first, then each migration SQL (and their JS ALTERs) in sequence.
 * Usage: node src/database/run-all-migrations.js
 *
 * Order:
 * 1. schema.sql (via migrate.js)
 * 2. flats: ALTERs + flats-enhance-migration.sql
 * 3. members: members-enhance-migration.sql
 * 4. marketplace: ALTERs + marketplace-enhance-migration.sql
 * 5. guard: ALTERs + guard-management-migration.sql
 * 6. resident-signup-requests-migration.sql
 * 7. invite-address (society_invites.address - single society address used everywhere)
 * 8. backfill-members-from-residents.sql (data only)
 */

const { spawn } = require('child_process');
const path = require('path');

const migrations = [
  { name: 'schema', run: 'node src/database/migrate.js' },
  { name: 'flats', run: 'node src/database/flats-migrate.js' },
  { name: 'members', run: 'node src/database/members-migrate.js' },
  { name: 'marketplace', run: 'node src/database/marketplace-migrate.js' },
  { name: 'guard', run: 'node src/database/guard-migrate.js' },
  { name: 'resident-signup-requests', run: 'node src/database/run-sql-file.js src/database/resident-signup-requests-migration.sql' },
  { name: 'invite-address', run: 'node src/database/invite-address-migrate.js' },
  { name: 'invite-society-id', run: 'node src/database/invite-society-id-migrate.js' },
  { name: 'payments', run: 'node src/database/payments-migrate.js' },
  { name: 'billing-cycle', run: 'node src/database/billing-cycle-migrate.js' },
  { name: 'society-plans', run: 'node src/database/society-plans-migrate.js' },
  { name: 'billing-invite-id', run: 'node src/database/billing-invite-id-migrate.js' },
  { name: 'society-notifications', run: 'node src/database/society-notifications-migrate.js' },
  { name: 'notifications', run: 'node src/database/notifications-migrate.js' },
  { name: 'backfill-members', run: 'node src/database/run-sql-file.js src/database/backfill-members-from-residents.sql' },
];

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const [node, ...args] = cmd.split(/\s+/);
    const child = spawn(node, args, { cwd, stdio: 'inherit', shell: true });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    child.on('error', reject);
  });
}

async function main() {
  const cwd = path.join(__dirname, '../..');
  console.log('Running all migrations from:', cwd);
  for (const m of migrations) {
    console.log('\n---', m.name, '---');
    await run(m.run, cwd);
  }
  console.log('\nAll migrations completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
