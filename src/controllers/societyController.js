const db = require('../config/database');
const redis = require('../utils/redis');

/** Public: list active societies for signup dropdown (id, name, alias only) */
async function listForSignup(req, res, next) {
  try {
    const { countryId, stateId, cityId, q } = req.query;

    let sql = `SELECT s.id, s.name, s.alias
               FROM societies s
               LEFT JOIN society_config c ON c.society_id = s.id
               WHERE s.status = 'active'`;
    const params = [];

    if (countryId != null && String(countryId).trim() !== '') {
      sql += ' AND s.country_id = ?';
      params.push(String(countryId).trim());
    }
    if (stateId != null && String(stateId).trim() !== '') {
      sql += ' AND s.state_id = ?';
      params.push(String(stateId).trim());
    }
    if (cityId != null && String(cityId).trim() !== '') {
      sql += ' AND s.city_id = ?';
      params.push(String(cityId).trim());
    }

    const qTrim = q != null ? String(q).trim() : '';
    if (qTrim) {
      sql += ' AND (s.name LIKE ? OR s.alias LIKE ? OR c.address LIKE ?)';
      params.push(`%${qTrim}%`, `%${qTrim}%`, `%${qTrim}%`);
    }

    sql += ' ORDER BY s.name LIMIT 200';

    const [rows] = await db.pool.execute(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({ id: r.id, name: r.name, alias: r.alias })),
    });
  } catch (err) {
    next(err);
  }
}

/** Public: list towers for a society (for signup form dropdown) */
async function listTowersForSignup(req, res, next) {
  try {
    const societyId = req.params.id;
    const [rows] = await db.pool.execute(
      `SELECT DISTINCT tower FROM flats WHERE society_id = ? AND tower IS NOT NULL AND TRIM(tower) != '' ORDER BY tower`,
      [societyId]
    );
    res.json({ success: true, data: rows.map((r) => r.tower) });
  } catch (err) {
    next(err);
  }
}

/** Public: list flats for a society (for signup form dropdown); optional ?tower=X to filter */
async function listFlatsForSignup(req, res, next) {
  try {
    const societyId = req.params.id;
    const tower = req.query.tower;
    let sql = `SELECT id, tower, flat_number FROM flats WHERE society_id = ?`;
    const params = [societyId];
    if (tower != null && String(tower).trim() !== '') {
      sql += ` AND tower = ?`;
      params.push(String(tower).trim());
    }
    sql += ` ORDER BY tower, flat_number LIMIT 500`;
    const [rows] = await db.pool.execute(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({ id: r.id, tower: r.tower, flatNumber: r.flat_number })),
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const [rows] = await db.pool.execute(
      `SELECT s.id, s.name, s.alias, s.email, s.phone, s.flat_count, s.plan_type, s.setup_fee, s.monthly_fee,
        s.billing_cycle, s.yearly_fee, s.status, s.created_at,
        c.logo, c.theme_color, c.address
       FROM societies s
       LEFT JOIN society_config c ON c.society_id = s.id
       ORDER BY s.created_at DESC`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        alias: r.alias,
        email: r.email,
        phone: r.phone,
        flatCount: r.flat_count,
        planType: r.plan_type,
        setupFee: parseFloat(r.setup_fee),
        monthlyFee: parseFloat(r.monthly_fee),
        billingCycle: r.billing_cycle || 'monthly',
        yearlyFee: parseFloat(r.yearly_fee || 0),
        status: r.status,
        createdAt: r.created_at,
        logo: r.logo,
        themeColor: r.theme_color,
        address: r.address,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = req.params.id || req.societyId;
    const [rows] = await db.pool.execute(
      `SELECT s.id, s.name, s.alias, s.email, s.phone, s.flat_count, s.plan_type, s.setup_fee, s.monthly_fee,
        s.billing_cycle, s.yearly_fee, s.status, s.created_at,
        c.logo, c.theme_color, c.address, c.banner_image, c.towers_blocks, c.total_flats, c.admin_contact_name, c.admin_contact_phone
       FROM societies s
       LEFT JOIN society_config c ON c.society_id = s.id
       WHERE s.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Society not found' });
    }
    const r = rows[0];
    let adminUsers = [];
    try {
      const [users] = await db.pool.execute(
        `SELECT id, name, email, role FROM users WHERE society_id = ? AND role = 'society_admin' ORDER BY id`,
        [id]
      );
      adminUsers = users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    } catch (_) {}
    res.json({
      success: true,
      data: {
        id: r.id,
        name: r.name,
        alias: r.alias,
        email: r.email,
        phone: r.phone,
        flatCount: r.flat_count,
        planType: r.plan_type,
        setupFee: parseFloat(r.setup_fee),
        monthlyFee: parseFloat(r.monthly_fee),
        billingCycle: r.billing_cycle || 'monthly',
        yearlyFee: parseFloat(r.yearly_fee || 0),
        status: r.status,
        createdAt: r.created_at,
        logo: r.logo,
        themeColor: r.theme_color,
        address: r.address,
        bannerImage: r.banner_image,
        towersBlocks: r.towers_blocks ? (typeof r.towers_blocks === 'string' ? JSON.parse(r.towers_blocks) : r.towers_blocks) : null,
        totalFlats: r.total_flats,
        adminContactName: r.admin_contact_name,
        adminContactPhone: r.admin_contact_phone,
        adminUsers,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getConfig(req, res, next) {
  try {
    const societyId = req.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const cacheKey = `society_config:${societyId}`;
    const cached = await redis.cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }
    const [rows] = await db.pool.execute(
      `SELECT logo, theme_color, address, banner_image, towers_blocks, total_flats, admin_contact_name, admin_contact_phone
       FROM society_config WHERE society_id = ?`,
      [societyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Society config not found' });
    }
    const r = rows[0];
    const data = {
      logo: r.logo,
      themeColor: r.theme_color,
      address: r.address,
      bannerImage: r.banner_image,
      towersBlocks: r.towers_blocks ? (typeof r.towers_blocks === 'string' ? JSON.parse(r.towers_blocks) : r.towers_blocks) : null,
      totalFlats: r.total_flats,
      adminContactName: r.admin_contact_name,
      adminContactPhone: r.admin_contact_phone,
    };
    await redis.cacheSet(cacheKey, data, 300);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.pool.execute('UPDATE societies SET status = ? WHERE id = ?', [status, id]);
    await redis.cacheDel(`society_config:${id}`);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = req.params.id || req.societyId;
    const { flatCount, monthlyFee, setupFee, billingCycle, yearlyFee } = req.body;
    const updates = [];
    const values = [];
    if (flatCount !== undefined) {
      updates.push('flat_count = ?');
      values.push(flatCount);
    }
    if (monthlyFee !== undefined) {
      updates.push('monthly_fee = ?');
      values.push(monthlyFee);
    }
    if (setupFee !== undefined) {
      updates.push('setup_fee = ?');
      values.push(setupFee);
    }
    if (billingCycle !== undefined && ['monthly', 'quarterly', 'yearly'].includes(String(billingCycle).toLowerCase())) {
      updates.push('billing_cycle = ?');
      values.push(String(billingCycle).toLowerCase());
    }
    if (yearlyFee !== undefined) {
      updates.push('yearly_fee = ?');
      values.push(parseFloat(yearlyFee) || 0);
    }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(societyId);
    await db.pool.execute(`UPDATE societies SET ${updates.join(', ')} WHERE id = ?`, values);
    await redis.cacheDel(`society_config:${societyId}`);
    res.json({ success: true, message: 'Society updated' });
  } catch (err) {
    next(err);
  }
}

async function updateConfig(req, res, next) {
  try {
    const societyId = req.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }

    const {
      logo,
      themeColor,
      address,
      bannerImage,
      towersBlocks,
      totalFlats,
      adminContactName,
      adminContactPhone,
    } = req.body;

    const updates = [];
    const values = [];

    if (logo !== undefined) {
      updates.push('logo = ?');
      values.push(logo || null);
    }
    if (themeColor !== undefined) {
      updates.push('theme_color = ?');
      values.push(themeColor || null);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address || null);
    }
    if (bannerImage !== undefined) {
      updates.push('banner_image = ?');
      values.push(bannerImage || null);
    }
    if (towersBlocks !== undefined) {
      const tbValue =
        Array.isArray(towersBlocks) && towersBlocks.length
          ? JSON.stringify(towersBlocks)
          : towersBlocks || null;
      updates.push('towers_blocks = ?');
      values.push(tbValue);
    }
    if (totalFlats !== undefined) {
      updates.push('total_flats = ?');
      values.push(totalFlats === null ? null : totalFlats);
    }
    if (adminContactName !== undefined) {
      updates.push('admin_contact_name = ?');
      values.push(adminContactName || null);
    }
    if (adminContactPhone !== undefined) {
      updates.push('admin_contact_phone = ?');
      values.push(adminContactPhone || null);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(societyId);

    await db.pool.execute(
      `UPDATE society_config SET ${updates.join(', ')} WHERE society_id = ?`,
      values
    );
    await redis.cacheDel(`society_config:${societyId}`);

    res.json({ success: true, message: 'Society config updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  listForSignup,
  listTowersForSignup,
  listFlatsForSignup,
  getById,
  getConfig,
  updateStatus,
  update,
  updateConfig,
};
