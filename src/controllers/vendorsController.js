const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { category } = req.query;
    let sql = `SELECT id, society_id, vendor_name, category, phone, description, service_area, rating, status, created_at
      FROM vendors WHERE society_id = ?`;
    const params = [societyId];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY vendor_name';
    const [rows] = await db.pool.execute(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        vendorName: r.vendor_name,
        category: r.category,
        phone: r.phone,
        description: r.description,
        serviceArea: r.service_area,
        rating: r.rating != null ? parseFloat(r.rating) : null,
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { vendorName, category, phone, description, serviceArea, status } = req.body;
    const [result] = await db.pool.execute(
      `INSERT INTO vendors (society_id, vendor_name, category, phone, description, service_area, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [societyId, vendorName, category, phone || null, description || null, serviceArea || null, status || 'active']
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        vendorName,
        category,
        phone: phone || null,
        description: description || null,
        serviceArea: serviceArea || null,
        status: status || 'active',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { vendorName, category, phone, description, serviceArea, status } = req.body;
    const updates = [];
    const values = [];
    if (vendorName !== undefined) {
      updates.push('vendor_name = ?');
      values.push(vendorName);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone || null);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (serviceArea !== undefined) {
      updates.push('service_area = ?');
      values.push(serviceArea || null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(id, societyId);
    const [result] = await db.pool.execute(
      `UPDATE vendors SET ${updates.join(', ')} WHERE id = ? AND society_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, message: 'Vendor updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM vendors WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, message: 'Vendor deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
