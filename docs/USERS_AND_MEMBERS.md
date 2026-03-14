# Users vs Members vs Residents

The app has **three related concepts**. Here’s how they work and how we keep them in sync.

## Tables

| Table       | Purpose |
|------------|---------|
| **users**  | Anyone who can **log in** (admin, society admin, resident, guard). One row per login account (email, password_hash, name, phone, role, society_id). |
| **residents** | Links a **user** (with role `resident`) to a **flat**. One row per “this user has access to this flat.” Used for app permissions and “my flats”. |
| **members** | **Directory profile** per person per flat: name, phone, email, family, vehicles, documents, emergency contacts. Can have `user_id` NULL (e.g. family member with no app login). |

So:

- **Member app login** uses **users** (auth) + **residents** (which flats they can see).
- **Directory / Members module** uses **members** (and related tables).

Having both **users** and **members** is intentional:

- **users** = who can log in and what role they have.
- **members** = rich directory data (family, vehicles, docs) that may exist even for people who don’t use the app.

## Sync (resident ↔ member)

To avoid “same person in two places”:

1. **When you add a Resident** (admin: Residents → Add): we create a **user** + **residents** row and **also create a member** row (same society_id, flat_id, user_id, name, phone, email). So that person appears in the directory and can log in.
2. **When you remove a Resident**: we delete the **residents** row, the **users** row, and the **member** row for that user+flat.

So:

- **Residents** = “who has app access and which flats.”
- **Members** = “who is in the directory” (and optionally linked to a user for app access).

If the **members** table doesn’t exist yet (e.g. you haven’t run the members-enhance migration), the resident create/remove still works; the member INSERT/DELETE is skipped without failing.

## Backfill

If you already had residents before this sync was added, run once:

```bash
# From backend folder, with DB credentials:
mysql -u your_user -p your_database < src/database/backfill-members-from-residents.sql
```

Or run the SQL in `backfill-members-from-residents.sql` in your DB client. It inserts into **members** for every **residents** row that doesn’t already have a matching member (same society_id, user_id, flat_id).

## Summary

- **users** = login accounts.
- **residents** = which flats a resident user has access to (for the app).
- **members** = directory entry (one per person per flat); synced with residents when they have app access.

The member app is for “members” (people living in the society) to log in; that login is done via **users** + **residents**; **members** is the directory view of the same people and stays in sync when you add/remove residents.
