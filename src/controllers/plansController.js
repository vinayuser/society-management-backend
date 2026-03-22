const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 20, maxLimit: 100 });
    const [countRows] = await db.pool.execute('SELECT COUNT(*) AS total FROM society_plans');
    const total = Number(countRows[0]?.total ?? 0);
    const [rows] = await db.pool.execute(
      `SELECT id, name, slug, billing_cycle, monthly_fee, yearly_fee, description, is_active, created_at
       FROM society_plans ORDER BY monthly_fee ASC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        billingCycle: r.billing_cycle,
        monthlyFee: parseFloat(r.monthly_fee),
        yearlyFee: parseFloat(r.yearly_fee),
        description: r.description || '',
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
      })),
      { page, limit, total }
    );
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, slug, billingCycle, monthlyFee, yearlyFee, description } = req.body;
    const billing_cycle = (billingCycle || 'monthly').toLowerCase();
    const derivedSlug = name ? String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '';
    const slugVal = (slug && slug.trim()) || derivedSlug || 'plan';
    const [result] = await db.pool.execute(
      `INSERT INTO society_plans (name, slug, billing_cycle, monthly_fee, yearly_fee, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name || 'Plan',
        slugVal,
        billing_cycle,
        parseFloat(monthlyFee) || 0,
        parseFloat(yearlyFee) || 0,
        description || null,
      ]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name: name || 'Plan',
        slug: slugVal,
        billingCycle: billing_cycle,
        monthlyFee: parseFloat(monthlyFee) || 0,
        yearlyFee: parseFloat(yearlyFee) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const { name, slug, billingCycle, monthlyFee, yearlyFee, description, isActive } = req.body;
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (slug !== undefined) {
      updates.push('slug = ?');
      values.push(slug);
    }
    if (billingCycle !== undefined) {
      updates.push('billing_cycle = ?');
      values.push(String(billingCycle).toLowerCase());
    }
    if (monthlyFee !== undefined) {
      updates.push('monthly_fee = ?');
      values.push(parseFloat(monthlyFee) || 0);
    }
    if (yearlyFee !== undefined) {
      updates.push('yearly_fee = ?');
      values.push(parseFloat(yearlyFee) || 0);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(id);
    const [r] = await db.pool.execute(
      `UPDATE society_plans SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.json({ success: true, message: 'Plan updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
