const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapItem(r) {
  let mediaUrls = r.media_urls;
  if (typeof mediaUrls === 'string') {
    try {
      mediaUrls = JSON.parse(mediaUrls);
    } catch (e) {
      mediaUrls = [];
    }
  }
  if (!Array.isArray(mediaUrls)) mediaUrls = [];
  if (r.image_url && !mediaUrls.length) mediaUrls = [r.image_url];
  return {
    id: r.id,
    societyId: r.society_id,
    userId: r.user_id,
    title: r.title,
    description: r.description,
    price: r.price != null ? parseFloat(r.price) : null,
    imageUrl: r.image_url,
    mediaUrls,
    category: r.category,
    itemCondition: r.item_condition,
    status: r.status,
    isPinned: !!r.is_pinned,
    listedGlobally: !!r.listed_globally,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sellerName: r.seller_name,
    societyName: r.society_name,
  };
}

const SELECT_COLS = `m.id, m.society_id, m.user_id, m.title, m.description, m.price, m.image_url, m.media_urls,
  m.category, m.item_condition, m.status, m.is_pinned, m.listed_globally, m.created_at, m.updated_at,
  u.name as seller_name`;

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { status, category, minPrice, maxPrice, condition } = req.query;
    const { page: pageNum, limit: limitNum, offset } = normalizePageLimit(req.query);

    let sql = `SELECT ${SELECT_COLS} FROM marketplace_items m JOIN users u ON u.id = m.user_id WHERE m.society_id = ?`;
    const params = [societyId];
    if (status && ['active', 'sold', 'removed'].includes(status)) {
      sql += ' AND m.status = ?';
      params.push(status);
    }
    if (category && String(category).trim()) {
      sql += ' AND m.category = ?';
      params.push(String(category).trim());
    }
    const minPriceNum = minPrice != null && minPrice !== '' ? parseFloat(minPrice) : NaN;
    if (!Number.isNaN(minPriceNum)) {
      sql += ' AND m.price >= ?';
      params.push(minPriceNum);
    }
    const maxPriceNum = maxPrice != null && maxPrice !== '' ? parseFloat(maxPrice) : NaN;
    if (!Number.isNaN(maxPriceNum)) {
      sql += ' AND m.price <= ?';
      params.push(maxPriceNum);
    }
    if (condition && ['new', 'used'].includes(condition)) {
      sql += ' AND m.item_condition = ?';
      params.push(condition);
    }
    const limitInt = limitNum;
    const offsetInt = offset;
    sql += ` ORDER BY m.is_pinned DESC, m.created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const countParams = [societyId];
    let countSql = 'SELECT COUNT(*) as total FROM marketplace_items m WHERE m.society_id = ?';
    if (status && ['active', 'sold', 'removed'].includes(status)) { countSql += ' AND m.status = ?'; countParams.push(status); }
    if (category && String(category).trim()) { countSql += ' AND m.category = ?'; countParams.push(String(category).trim()); }
    if (!Number.isNaN(minPriceNum)) { countSql += ' AND m.price >= ?'; countParams.push(minPriceNum); }
    if (!Number.isNaN(maxPriceNum)) { countSql += ' AND m.price <= ?'; countParams.push(maxPriceNum); }
    if (condition && ['new', 'used'].includes(condition)) { countSql += ' AND m.item_condition = ?'; countParams.push(condition); }
    const [countResult] = await db.pool.execute(countSql, countParams);
    const total = countResult[0]?.total ?? 0;

    const [rows] = await db.pool.execute(sql, params);

    jsonCollection(res, rows.map(mapItem), { page: pageNum, limit: limitNum, total });
  } catch (err) {
    next(err);
  }
}

async function listGlobal(req, res, next) {
  try {
    const { societyId, category, minPrice, maxPrice, condition, sort = 'newest' } = req.query;
    const { page: pageNum, limit: limitNum, offset } = normalizePageLimit(req.query);

    let sql = `SELECT ${SELECT_COLS}, s.name as society_name FROM marketplace_items m
      JOIN users u ON u.id = m.user_id
      JOIN societies s ON s.id = m.society_id
      WHERE m.listed_globally = 1 AND m.status = 'active'`;
    const params = [];
    if (societyId && parseInt(societyId, 10)) {
      sql += ' AND m.society_id = ?';
      params.push(societyId);
    }
    if (category && String(category).trim()) {
      sql += ' AND m.category = ?';
      params.push(String(category).trim());
    }
    const minPriceNum = minPrice != null && minPrice !== '' ? parseFloat(minPrice) : NaN;
    if (!Number.isNaN(minPriceNum)) {
      sql += ' AND m.price >= ?';
      params.push(minPriceNum);
    }
    const maxPriceNum = maxPrice != null && maxPrice !== '' ? parseFloat(maxPrice) : NaN;
    if (!Number.isNaN(maxPriceNum)) {
      sql += ' AND m.price <= ?';
      params.push(maxPriceNum);
    }
    if (condition && ['new', 'used'].includes(condition)) {
      sql += ' AND m.item_condition = ?';
      params.push(condition);
    }
    if (sort === 'price_asc') sql += ' ORDER BY m.price IS NULL, m.price ASC, m.created_at DESC';
    else if (sort === 'price_desc') sql += ' ORDER BY m.price DESC, m.created_at DESC';
    else sql += ' ORDER BY m.is_pinned DESC, m.created_at DESC';
    const limitInt = limitNum;
    const offsetInt = offset;
    sql += ` LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const countParams = [];
    let countSql = `SELECT COUNT(*) as total FROM marketplace_items m
      JOIN societies s ON s.id = m.society_id
      WHERE m.listed_globally = 1 AND m.status = 'active'`;
    if (societyId && parseInt(societyId, 10)) {
      countSql += ' AND m.society_id = ?';
      countParams.push(societyId);
    }
    if (category && String(category).trim()) {
      countSql += ' AND m.category = ?';
      countParams.push(String(category).trim());
    }
    if (!Number.isNaN(minPriceNum)) {
      countSql += ' AND m.price >= ?';
      countParams.push(minPriceNum);
    }
    if (!Number.isNaN(maxPriceNum)) {
      countSql += ' AND m.price <= ?';
      countParams.push(maxPriceNum);
    }
    if (condition && ['new', 'used'].includes(condition)) {
      countSql += ' AND m.item_condition = ?';
      countParams.push(condition);
    }
    const [countResult] = await db.pool.execute(countSql, countParams);
    const total = countResult[0]?.total ?? 0;

    const [rows] = await db.pool.execute(sql, params);
    jsonCollection(res, rows.map(mapItem), { page: pageNum, limit: limitNum, total });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [rows] = await db.pool.execute(
      `SELECT ${SELECT_COLS}, s.name as society_name FROM marketplace_items m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN societies s ON s.id = m.society_id
       WHERE m.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    const row = rows[0];
    if (societyId && row.society_id !== societyId && !row.listed_globally) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, data: mapItem(row) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { title, description, price, imageUrl, mediaUrls, category, itemCondition } = req.body;
    const mediaArr = Array.isArray(mediaUrls) ? mediaUrls : (imageUrl ? [imageUrl] : []);
    const mediaJson = JSON.stringify(mediaArr);
    const [result] = await db.pool.execute(
      `INSERT INTO marketplace_items (society_id, user_id, title, description, price, image_url, media_urls, category, item_condition, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        societyId,
        userId,
        title,
        description || null,
        price ?? null,
        mediaArr[0] || imageUrl || null,
        mediaJson,
        category || null,
        itemCondition === 'new' ? 'new' : 'used',
      ]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        userId,
        title,
        description: description || null,
        price: price ?? null,
        mediaUrls: mediaArr,
        category: category || null,
        itemCondition: itemCondition === 'new' ? 'new' : 'used',
        status: 'active',
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
    const { title, description, price, mediaUrls, category, itemCondition } = req.body;
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description ?? null); }
    if (price !== undefined) { updates.push('price = ?'); values.push(price ?? null); }
    if (mediaUrls !== undefined) {
      const arr = Array.isArray(mediaUrls) ? mediaUrls : [];
      updates.push('media_urls = ?'); values.push(JSON.stringify(arr));
      updates.push('image_url = ?'); values.push(arr[0] || null);
    }
    if (category !== undefined) { updates.push('category = ?'); values.push(category || null); }
    if (itemCondition !== undefined) { updates.push('item_condition = ?'); values.push(itemCondition === 'new' ? 'new' : 'used'); }
    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(id, societyId);
    const [result] = await db.pool.execute(
      `UPDATE marketplace_items SET ${updates.join(', ')} WHERE id = ? AND society_id = ?`,
      values
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Item updated' });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { status } = req.body;
    const [result] = await db.pool.execute(
      'UPDATE marketplace_items SET status = ? WHERE id = ? AND society_id = ?',
      [status, id, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Listing not found' });
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    next(err);
  }
}

async function pin(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { isPinned } = req.body;
    const [result] = await db.pool.execute(
      'UPDATE marketplace_items SET is_pinned = ? WHERE id = ? AND society_id = ?',
      [isPinned ? 1 : 0, id, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: isPinned ? 'Item pinned' : 'Item unpinned' });
  } catch (err) {
    next(err);
  }
}

async function setListedGlobally(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { listedGlobally } = req.body;
    const [result] = await db.pool.execute(
      'UPDATE marketplace_items SET listed_globally = ? WHERE id = ? AND society_id = ?',
      [listedGlobally ? 1 : 0, id, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: listedGlobally ? 'Listed globally' : 'Removed from global' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM marketplace_items WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Listing not found' });
    res.json({ success: true, message: 'Listing removed' });
  } catch (err) {
    next(err);
  }
}

async function uploadMedia(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });
    const baseUrl = process.env.API_BASE_URL || '';
    const basePath = '/uploads/marketplace/' + societyId + '/';
    const newUrls = req.files.map((f) => (baseUrl ? baseUrl + basePath + f.filename : basePath + f.filename));
    const [rows] = await db.pool.execute(
      'SELECT media_urls, image_url FROM marketplace_items WHERE id = ? AND society_id = ?',
      [id, societyId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    let mediaUrls = rows[0].media_urls;
    if (typeof mediaUrls === 'string') try { mediaUrls = JSON.parse(mediaUrls); } catch (e) { mediaUrls = []; }
    if (!Array.isArray(mediaUrls)) mediaUrls = rows[0].image_url ? [rows[0].image_url] : [];
    const combined = [...mediaUrls, ...newUrls];
    await db.pool.execute(
      'UPDATE marketplace_items SET media_urls = ?, image_url = ? WHERE id = ? AND society_id = ?',
      [JSON.stringify(combined), combined[0] || null, id, societyId]
    );
    res.json({ success: true, data: { mediaUrls: combined } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  listGlobal,
  getOne,
  create,
  update,
  updateStatus,
  pin,
  setListedGlobally,
  remove,
  uploadMedia,
};
