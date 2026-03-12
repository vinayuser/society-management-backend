const db = require('../config/database');
const redis = require('../utils/redis');

async function list(req, res, next) {
  try {
    const [rows] = await db.pool.execute(
      `SELECT s.id, s.name, s.alias, s.email, s.phone, s.flat_count, s.plan_type, s.setup_fee, s.monthly_fee, s.status, s.created_at,
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
      `SELECT s.id, s.name, s.alias, s.email, s.phone, s.flat_count, s.plan_type, s.setup_fee, s.monthly_fee, s.status, s.created_at,
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
    const { flatCount, monthlyFee, setupFee } = req.body;
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

module.exports = { list, getById, getConfig, updateStatus, update, updateConfig };
