const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) return res.status(400).json({ success: false, message: 'Society context required' });
    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * limitNum;
    const limitInt = parseInt(limitNum, 10);
    const offsetInt = parseInt(offset, 10);

    const [rows] = await db.pool.execute(
      `SELECT t.id, t.buyer_user_id, t.seller_user_id, t.item_id, t.society_id, t.transaction_status, t.created_at,
        b.name as buyer_name, s.name as seller_name, m.title as item_title, m.price as item_price
       FROM marketplace_transactions t
       JOIN users b ON b.id = t.buyer_user_id
       JOIN users s ON s.id = t.seller_user_id
       JOIN marketplace_items m ON m.id = t.item_id
       WHERE t.society_id = ?
       ORDER BY t.created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`,
      [societyId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        buyerUserId: r.buyer_user_id,
        sellerUserId: r.seller_user_id,
        itemId: r.item_id,
        societyId: r.society_id,
        transactionStatus: r.transaction_status,
        createdAt: r.created_at,
        buyerName: r.buyer_name,
        sellerName: r.seller_name,
        itemTitle: r.item_title,
        itemPrice: r.item_price != null ? parseFloat(r.item_price) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const buyerUserId = req.user?.id;
    if (!buyerUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { itemId } = req.body;
    const [itemRows] = await db.pool.execute(
      'SELECT id, user_id, society_id FROM marketplace_items WHERE id = ? AND society_id = ? AND status = ?',
      [itemId, societyId, 'active']
    );
    if (!itemRows.length) return res.status(404).json({ success: false, message: 'Item not found or not available' });
    const sellerUserId = itemRows[0].user_id;
    const [result] = await db.pool.execute(
      `INSERT INTO marketplace_transactions (buyer_user_id, seller_user_id, item_id, society_id, transaction_status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [buyerUserId, sellerUserId, itemId, societyId]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        buyerUserId,
        sellerUserId,
        itemId,
        societyId,
        transactionStatus: 'pending',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create };
