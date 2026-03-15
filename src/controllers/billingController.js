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
    let sql = `SELECT b.id, b.society_id, b.amount, b.type, b.billing_date, b.due_date, b.payment_status, b.paid_at, b.reminder_sent_at, b.invoice_number, b.notes, b.created_at,
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
    let billingSummary = null;
    if (societyId) {
      const [soc] = await db.pool.execute(
        'SELECT billing_cycle, monthly_fee, yearly_fee FROM societies WHERE id = ?',
        [societyId]
      );
      if (soc.length) {
        const c = (soc[0].billing_cycle || 'monthly').toLowerCase();
        const monthlyFee = parseFloat(soc[0].monthly_fee || 0);
        const yearlyFee = parseFloat(soc[0].yearly_fee || 0);
        billingSummary = {
          billingCycle: c,
          monthlyFee,
          yearlyFee,
          periodLabel: c === 'yearly' ? 'Yearly' : c === 'quarterly' ? 'Quarterly' : 'Monthly',
          periodAmount: c === 'yearly' ? (yearlyFee || monthlyFee * 12) : c === 'quarterly' ? (yearlyFee ? yearlyFee / 4 : monthlyFee * 3) : monthlyFee,
        };
      }
    }
    const payload = {
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
        reminderSentAt: r.reminder_sent_at,
        invoiceNumber: r.invoice_number,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    };
    if (billingSummary) payload.billingSummary = billingSummary;
    res.json(payload);
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

async function createOrder(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { id } = req.params;
    const [rows] = await db.pool.execute(
      'SELECT id, amount, payment_status FROM billing WHERE id = ? AND society_id = ?',
      [id, societyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const row = rows[0];
    if (row.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice already paid' });
    }
    const amountPaise = Math.round(parseFloat(row.amount) * 100);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.status(503).json({ success: false, message: 'Razorpay not configured' });
    }
    let Razorpay;
    try {
      Razorpay = require('razorpay');
    } catch (e) {
      return res.status(503).json({ success: false, message: 'Razorpay package not installed' });
    }
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `billing-${row.id}`,
      notes: { billingId: String(row.id), societyId: String(societyId) },
    });
    await db.pool.execute('UPDATE billing SET razorpay_order_id = ? WHERE id = ?', [order.id, row.id]);
    res.json({
      success: true,
      data: { orderId: order.id, amount: amountPaise, currency: 'INR', keyId },
    });
  } catch (err) {
    next(err);
  }
}

async function verifyBillingPayment(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { razorpay_order_id, razorpay_payment_id } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, message: 'razorpay_order_id and razorpay_payment_id required' });
    }
    const [billingRows] = await db.pool.execute(
      'SELECT id FROM billing WHERE razorpay_order_id = ? AND society_id = ? AND payment_status = ?',
      [razorpay_order_id, societyId, 'pending']
    );
    if (!billingRows.length) {
      return res.status(404).json({ success: false, message: 'Order not found or already paid' });
    }
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return res.status(400).json({ success: false, message: 'Payment not captured' });
    }
    await db.pool.execute(
      'UPDATE billing SET payment_status = ?, paid_at = NOW(), razorpay_payment_id = ? WHERE id = ?',
      ['paid', razorpay_payment_id, billingRows[0].id]
    );
    res.json({ success: true, data: { message: 'Payment recorded' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, updatePaymentStatus, createOrder, verifyBillingPayment };
