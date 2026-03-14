-- Backfill: create member rows for existing residents so directory and app login stay in sync.
-- Run this once if you had residents before the sync was added. Safe to run multiple times
-- (INSERT IGNORE skips where a member already exists for that user_id + flat_id + society_id).

-- Requires: members table (from members-enhance-migration.sql).

INSERT IGNORE INTO members (society_id, flat_id, user_id, name, phone, email, role, status)
SELECT r.society_id, r.flat_id, r.user_id, COALESCE(u.name, ''), u.phone, u.email, 'resident', 'active'
FROM residents r
JOIN users u ON u.id = r.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM members m
  WHERE m.society_id = r.society_id AND m.user_id = r.user_id AND m.flat_id = r.flat_id
);
