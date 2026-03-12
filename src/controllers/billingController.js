const db = require('../config/database');
const config = require('../config');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = req.query.societyId || getSocietyId(req);
    if (!societyId && req.user?.role !== config.roles.SUPER_ADMIN) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    let sql = `SELECT b.id, b.society_id, b.amount, b.type, b.billing_date, b.due_date, b.payment_status, b.paid_at, b.invoice_number, b.notes, b.created_at,
      s.name as society_name, s.alias as society_alias
      FROM billing b
      LEFT JOIN societies s ON s.id = b.society_id
      WHERE 1=1`;
    const params = [];
    if (societyId) {
      sql += ' AND b.society_id = ?';
      params.push(societyId);
    }
    sql += ' ORDER BY b.billing_date DESC';
    const [rows] = await db.pool.execute(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        societyName: r.society_name,
        societyAlias: r.society_alias,
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

async function create(req, res, next) {
  try {
    const societyId = req.body.societyId || getSocietyId(req);
    const { amount, type, billingDate, dueDate, notes } = req.body;
    const invoiceNumber = `INV-${Date.now()}-${societyId}`;
    const [result] = await db.pool.execute(
      `INSERT INTO billing (society_id, amount, type, billing_date, due_date, payment_status, invoice_number, notes)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [societyId, amount, type, billingDate, dueDate || billingDate, invoiceNumber, notes || null]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        amount,
        type,
        billingDate,
        dueDate: dueDate || billingDate,
        invoiceNumber,
        paymentStatus: 'pending',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updatePaymentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    const paidAt = paymentStatus === 'paid' ? new Date() : null;
    const [result] = await db.pool.execute(
      'UPDATE billing SET payment_status = ?, paid_at = ? WHERE id = ?',
      [paymentStatus, paidAt, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Payment status updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, updatePaymentStatus };
