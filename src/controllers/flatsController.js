const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapFlat(r) {
  return {
    id: r.id,
    societyId: r.society_id,
    tower: r.tower,
    flatNumber: r.flat_number,
    floor: r.floor,
    flatType: r.flat_type,
    areaSqft: r.area_sqft != null ? parseFloat(r.area_sqft) : null,
    ownershipType: r.ownership_type,
    ownerName: r.owner_name,
    ownerContact: r.owner_contact,
    ownerEmail: r.owner_email,
    status: r.status,
    membersCount: r.members_count,
    vehiclesCount: r.vehicles_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { search, tower, status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let sql = `SELECT f.id, f.society_id, f.tower, f.flat_number, f.floor, f.flat_type, f.area_sqft, f.ownership_type,
      f.owner_name, f.owner_contact, f.owner_email, f.status, f.created_at, f.updated_at,
      ((SELECT COUNT(*) FROM flat_members fm WHERE fm.flat_id = f.id AND fm.society_id = f.society_id) + (SELECT COUNT(*) FROM members m WHERE m.flat_id = f.id AND m.society_id = f.society_id)) AS members_count,
      (SELECT COUNT(*) FROM flat_vehicles fv WHERE fv.flat_id = f.id AND fv.society_id = f.society_id) AS vehicles_count
      FROM flats f WHERE f.society_id = ?`;
    const params = [societyId];

    if (search && String(search).trim()) {
      sql += ` AND (f.flat_number LIKE ? OR f.owner_name LIKE ? OR f.tower LIKE ?)`;
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }
    if (tower && String(tower).trim()) {
      sql += ' AND f.tower = ?';
      params.push(String(tower).trim());
    }
    if (status && String(status).trim()) {
      sql += ' AND f.status = ?';
      params.push(String(status).trim());
    }

    const countParams = [societyId];
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      countParams.push(term, term, term);
    }
    if (tower && String(tower).trim()) countParams.push(String(tower).trim());
    if (status && String(status).trim()) countParams.push(String(status).trim());

    let countSql = 'SELECT COUNT(*) AS total FROM flats f WHERE f.society_id = ?';
    if (search && String(search).trim()) countSql += ' AND (f.flat_number LIKE ? OR f.owner_name LIKE ? OR f.tower LIKE ?)';
    if (tower && String(tower).trim()) countSql += ' AND f.tower = ?';
    if (status && String(status).trim()) countSql += ' AND f.status = ?';
    const [countRows] = await db.pool.execute(countSql, countParams);
    const total = countRows[0]?.total ?? 0;

    sql += ` ORDER BY f.tower, f.flat_number LIMIT ${limitNum} OFFSET ${offset}`;
    const [rows] = await db.pool.execute(sql, params);

    res.json({
      success: true,
      data: rows.map(mapFlat),
      pagination: { page: pageNum, limit: limitNum, total },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, tower, flat_number, floor, flat_type, area_sqft, ownership_type,
       owner_name, owner_contact, owner_email, status, created_at, updated_at
       FROM flats WHERE id = ? AND society_id = ?`,
      [id, societyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    const r = rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        societyId: r.society_id,
        tower: r.tower,
        flatNumber: r.flat_number,
        floor: r.floor,
        flatType: r.flat_type,
        areaSqft: r.area_sqft != null ? parseFloat(r.area_sqft) : null,
        ownershipType: r.ownership_type,
        ownerName: r.owner_name,
        ownerContact: r.owner_contact,
        ownerEmail: r.owner_email,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const {
      tower,
      flatNumber,
      floor,
      flatType,
      areaSqft,
      ownershipType,
      ownerName,
      ownerContact,
      ownerEmail,
      status,
    } = req.body;
    const [result] = await db.pool.execute(
      `INSERT INTO flats (society_id, tower, flat_number, floor, flat_type, area_sqft, ownership_type,
       owner_name, owner_contact, owner_email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        societyId,
        tower,
        flatNumber,
        floor ?? null,
        flatType ?? null,
        areaSqft ?? null,
        ownershipType ?? null,
        ownerName ?? null,
        ownerContact ?? null,
        ownerEmail ?? null,
        status || 'active',
      ]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        tower,
        flatNumber,
        floor: floor ?? null,
        flatType: flatType ?? null,
        areaSqft: areaSqft ?? null,
        ownershipType: ownershipType ?? null,
        ownerName: ownerName ?? null,
        ownerContact: ownerContact ?? null,
        ownerEmail: ownerEmail ?? null,
        status: status || 'active',
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Flat already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const body = req.body || {};
    const allowed = [
      'tower', 'flatNumber', 'floor', 'flatType', 'areaSqft', 'ownershipType',
      'ownerName', 'ownerContact', 'ownerEmail', 'status',
    ];
    const set = [];
    const params = [];
    const colMap = { flatNumber: 'flat_number', flatType: 'flat_type', areaSqft: 'area_sqft', ownershipType: 'ownership_type', ownerName: 'owner_name', ownerContact: 'owner_contact', ownerEmail: 'owner_email' };
    for (const k of allowed) {
      if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
      const col = colMap[k] || k;
      set.push(`${col} = ?`);
      params.push(body[k] === '' || body[k] === null ? null : body[k]);
    }
    if (set.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    set.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, societyId);
    const [result] = await db.pool.execute(
      `UPDATE flats SET ${set.join(', ')} WHERE id = ? AND society_id = ?`,
      params
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, tower, flat_number, floor, flat_type, area_sqft, ownership_type,
       owner_name, owner_contact, owner_email, status, created_at, updated_at FROM flats WHERE id = ?`,
      [id]
    );
    const r = rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        societyId: r.society_id,
        tower: r.tower,
        flatNumber: r.flat_number,
        floor: r.floor,
        flatType: r.flat_type,
        areaSqft: r.area_sqft != null ? parseFloat(r.area_sqft) : null,
        ownershipType: r.ownership_type,
        ownerName: r.owner_name,
        ownerContact: r.owner_contact,
        ownerEmail: r.owner_email,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Flat already exists' });
    }
    next(err);
  }
}

async function bulkCreate(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { flats } = req.body;
    if (!Array.isArray(flats) || !flats.length) {
      return res.status(400).json({ success: false, message: 'flats array required' });
    }
    const inserted = [];
    for (const f of flats) {
      const tower = f.tower || f.towerBlock;
      const flatNumber = f.flatNumber || f.flat_number;
      if (!tower || !flatNumber) continue;
      try {
        const [r] = await db.pool.execute(
          'INSERT INTO flats (society_id, tower, flat_number) VALUES (?, ?, ?)',
          [societyId, tower, String(flatNumber)]
        );
        inserted.push({ id: r.insertId, tower, flatNumber });
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    res.status(201).json({ success: true, data: { created: inserted.length, flats: inserted } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM flats WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    res.json({ success: true, message: 'Flat deleted' });
  } catch (err) {
    next(err);
  }
}

async function listComplaints(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    const [rows] = await db.pool.execute(
      `SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.resolved_at, c.created_at, u.name AS user_name, u.phone AS user_phone
       FROM complaints c
       JOIN users u ON u.id = c.user_id
       JOIN residents r ON r.user_id = c.user_id AND r.flat_id = ?
       WHERE c.society_id = ?
       ORDER BY c.created_at DESC`,
      [flatId, societyId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userPhone: r.user_phone,
        title: r.title,
        description: r.description,
        category: r.category,
        status: r.status,
        resolvedAt: r.resolved_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function listBilling(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, flat_id, amount, type, billing_date, due_date, payment_status, paid_at, invoice_number, notes, created_at
       FROM billing WHERE society_id = ? AND flat_id = ? ORDER BY billing_date DESC`,
      [societyId, flatId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        flatId: r.flat_id,
        amount: parseFloat(r.amount),
        type: r.type,
        billingDate: r.billing_date,
        dueDate: r.due_date,
        paymentStatus: r.payment_status,
        paidAt: r.paid_at,
        invoiceNumber: r.invoice_number,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, bulkCreate, remove, listComplaints, listBilling };
