const db = require('../config/database');

/** Get user IDs for society admins of a society (for platform notifications) */
async function getSocietyAdminUserIds(societyId) {
  const [rows] = await db.pool.execute(
    'SELECT id FROM users WHERE society_id = ? AND role = ?',
    [societyId, 'society_admin']
  );
  return rows.map((r) => r.id);
}

/** Insert notification for each society admin user */
async function notifySocietyAdmins(societyId, type, title, body, referenceId = null) {
  try {
    const userIds = await getSocietyAdminUserIds(societyId);
    if (userIds.length === 0) {
      console.warn(`[notifySocietyAdmins] No society_admin users found for society_id=${societyId}`);
      return;
    }
    for (const userId of userIds) {
      await db.pool.execute(
        'INSERT INTO notifications (user_id, type, title, body, reference_id) VALUES (?, ?, ?, ?, ?)',
        [userId, type, title, body, referenceId]
      );
    }
  } catch (err) {
    console.error('[notifySocietyAdmins] Failed to insert notification:', err.message);
    throw err;
  }
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format YYYY-MM-DD as "1 Mar 2025" for notification body */
function formatDueDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/** Which month indices (1-12) are billing months for a cycle */
function billingMonthsForCycle(cycle) {
  if (cycle === 'quarterly') return [3, 6, 9, 12];
  if (cycle === 'yearly') return [12];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

/** Map billing row month to display column (quarterly: 1,2,3->3; 4,5,6->6; etc.) */
function displayMonthForBilling(monthNum, type) {
  if (type === 'quarterly') return Math.ceil(monthNum / 3) * 3;
  if (type === 'yearly') return 12;
  return monthNum;
}

/** Super admin: list societies with per-month payment status for a year */
async function overview(req, res, next) {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const [societies] = await db.pool.execute(
      `SELECT id, name, alias, monthly_fee, yearly_fee, billing_cycle, created_at
       FROM societies WHERE status IN ('active', 'onboarding_completed', 'suspended') ORDER BY name`
    );
    const [billingRows] = await db.pool.execute(
      `SELECT society_id, MONTH(billing_date) as month, amount, payment_status, type
       FROM billing
       WHERE type IN ('setup', 'monthly', 'quarterly', 'yearly') AND YEAR(billing_date) = ?
       ORDER BY society_id, month`,
      [year]
    );
    const bySocietyMonth = {};
    for (const r of billingRows) {
      const displayMonth = displayMonthForBilling(r.month, r.type || 'monthly');
      const key = `${r.society_id}-${displayMonth}`;
      if (!bySocietyMonth[key]) bySocietyMonth[key] = { amountDue: 0, amountPaid: 0 };
      const amt = parseFloat(r.amount || 0);
      bySocietyMonth[key].amountDue += amt;
      if (r.payment_status === 'paid') bySocietyMonth[key].amountPaid += amt;
    }
    const data = societies.map((s) => {
      const monthlyFee = parseFloat(s.monthly_fee || 0);
      const yearlyFee = parseFloat(s.yearly_fee || 0);
      const cycle = (s.billing_cycle || 'monthly').toLowerCase();
      const billingMonths = billingMonthsForCycle(cycle);
      const periodAmount = cycle === 'monthly' ? monthlyFee : cycle === 'quarterly' ? (yearlyFee > 0 ? yearlyFee / 4 : monthlyFee * 3) : yearlyFee || monthlyFee * 12;
      const created = s.created_at ? new Date(s.created_at) : null;
      const societyStartMonth = created ? created.getFullYear() * 12 + (created.getMonth() + 1) : 0;
      const months = {};
      for (let m = 1; m <= 12; m++) {
        const monthKey = year * 12 + m;
        const beforeSocietyExists = societyStartMonth > 0 && monthKey < societyStartMonth;
        const isBillingMonth = billingMonths.indexOf(m) !== -1;
        const key = `${s.id}-${m}`;
        const agg = bySocietyMonth[key];
        const amountDue = agg ? agg.amountDue : (beforeSocietyExists || !isBillingMonth ? 0 : periodAmount);
        const amountPaid = agg ? agg.amountPaid : 0;
        let status = 'due';
        if (beforeSocietyExists || !isBillingMonth) {
          status = 'na';
        } else if (amountPaid >= amountDue && amountDue > 0) {
          status = 'paid';
        } else if (amountPaid > 0) {
          status = 'partial';
        }
        months[m] = {
          month: m,
          monthLabel: MONTHS[m - 1],
          status,
          amountDue,
          amountPaid,
        };
      }
      return {
        id: s.id,
        name: s.name,
        alias: s.alias,
        monthlyFee,
        yearlyFee,
        billingCycle: cycle,
        months,
      };
    });
    res.json({ success: true, data, year });
  } catch (err) {
    next(err);
  }
}

/** Super admin: get full detail for a society's month (all transactions) */
async function monthDetail(req, res, next) {
  try {
    const societyId = parseInt(req.query.societyId, 10);
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!societyId || !year || !month || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'societyId, year, month (1-12) required' });
    }
    const [societies] = await db.pool.execute(
      'SELECT id, name, alias, monthly_fee, yearly_fee, billing_cycle FROM societies WHERE id = ?',
      [societyId]
    );
    if (!societies.length) {
      return res.status(404).json({ success: false, message: 'Society not found' });
    }
    const society = societies[0];
    const monthlyFee = parseFloat(society.monthly_fee || 0);
    const yearlyFee = parseFloat(society.yearly_fee || 0);
    const billingCycle = (society.billing_cycle || 'monthly').toLowerCase();
    const [rows] = await db.pool.execute(
      `SELECT id, amount, type, billing_date, due_date, payment_status, paid_at, invoice_number, notes,
        previous_balance, razorpay_order_id, razorpay_payment_id, created_at
       FROM billing
       WHERE society_id = ? AND type IN ('monthly', 'setup', 'quarterly', 'yearly') AND YEAR(billing_date) = ? AND MONTH(billing_date) = ?
       ORDER BY created_at ASC`,
      [societyId, year, month]
    );
    let previousBalance = 0;
    const transactions = rows.map((r) => {
      const prev = r.previous_balance != null ? parseFloat(r.previous_balance) : null;
      if (prev != null) previousBalance = prev;
      return {
        id: r.id,
        amount: parseFloat(r.amount),
        type: r.type,
        billingDate: r.billing_date,
        dueDate: r.due_date,
        paymentStatus: r.payment_status,
        paidAt: r.paid_at,
        invoiceNumber: r.invoice_number,
        notes: r.notes,
        previousBalance: prev,
        razorpayOrderId: r.razorpay_order_id,
        razorpayPaymentId: r.razorpay_payment_id,
        createdAt: r.created_at,
      };
    });
    const totalPaid = transactions.filter((t) => t.paymentStatus === 'paid').reduce((s, t) => s + t.amount, 0);
    const totalInvoiced = transactions.reduce((s, t) => s + t.amount, 0);
    const periodAmount = billingCycle === 'yearly' ? (yearlyFee || monthlyFee * 12) : billingCycle === 'quarterly' ? (yearlyFee ? yearlyFee / 4 : monthlyFee * 3) : monthlyFee;
    res.json({
      success: true,
      data: {
        society: {
          id: society.id,
          name: society.name,
          alias: society.alias,
          monthlyFee,
          yearlyFee,
          billingCycle,
        },
        year,
        month,
        monthLabel: MONTHS[month - 1],
        amountDue: periodAmount,
        totalInvoiced,
        totalPaid,
        previousBalance: transactions.length ? (transactions[0].previousBalance ?? 0) : 0,
        status: totalPaid >= periodAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'due',
        transactions,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Super admin: send payment reminder; update billing.reminder_sent_at and create notification for society admin */
async function sendReminder(req, res, next) {
  try {
    const { societyId, year, month } = req.body;
    if (!societyId || !year || !month) {
      return res.status(400).json({ success: false, message: 'societyId, year, month required' });
    }
    const [societies] = await db.pool.execute(
      'SELECT id, name, email FROM societies WHERE id = ?',
      [societyId]
    );
    if (!societies.length) {
      return res.status(404).json({ success: false, message: 'Society not found' });
    }
    const societyName = societies[0].name || 'Your society';
    const monthLabel = MONTHS[month - 1];
    await db.pool.execute(
      `UPDATE billing SET reminder_sent_at = NOW() WHERE society_id = ? AND type IN ('monthly', 'quarterly', 'yearly') AND YEAR(billing_date) = ? AND MONTH(billing_date) = ?`,
      [societyId, year, month]
    );
    const title = `Payment reminder: ${societyName} — ${monthLabel} ${year}`;
    const body = `A payment reminder was sent for ${monthLabel} ${year}. Please clear any pending invoices for "${societyName}" in Dashboard → Invoices & Payments.`;
    await notifySocietyAdmins(societyId, 'payment_reminder', title, body);
    res.json({
      success: true,
      data: { message: `Reminder sent for ${societies[0].name} (${monthLabel} ${year}). Society admin will see it in their Payments page.` },
    });
  } catch (err) {
    next(err);
  }
}

/** Create Razorpay order for a billing invoice (optional) */
async function createOrder(req, res, next) {
  try {
    const { billingId } = req.body;
    if (!billingId) {
      return res.status(400).json({ success: false, message: 'billingId required' });
    }
    const [rows] = await db.pool.execute(
      'SELECT id, society_id, amount, payment_status FROM billing WHERE id = ?',
      [billingId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const row = rows[0];
    if (row.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice already paid' });
    }
    const amountPaise = Math.round(parseFloat(row.amount) * 100);
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(503).json({
        success: false,
        message: 'Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      });
    }
    let Razorpay;
    try {
      Razorpay = require('razorpay');
    } catch (e) {
      return res.status(503).json({
        success: false,
        message: 'Razorpay package not installed. Run: npm install razorpay',
      });
    }
    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `billing-${row.id}`,
      notes: { billingId: String(row.id), societyId: String(row.society_id) },
    });
    await db.pool.execute(
      'UPDATE billing SET razorpay_order_id = ? WHERE id = ?',
      [order.id, row.id]
    );
    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: razorpayKeyId,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Super admin: generate recurring invoices for a given period (year + month). Creates missing billing rows per society. */
async function generateRecurring(req, res, next) {
  try {
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();
    const month = parseInt(req.body.month, 10) || new Date().getMonth() + 1;
    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'month must be 1-12' });
    }

    const [societies] = await db.pool.execute(
      `SELECT id, name, monthly_fee, yearly_fee, billing_cycle FROM societies WHERE status IN ('active', 'onboarding_completed', 'suspended')`
    );
    let created = 0;

    for (const s of societies) {
      const cycle = (s.billing_cycle || 'monthly').toLowerCase();
      const monthlyFee = parseFloat(s.monthly_fee || 0);
      const yearlyFee = parseFloat(s.yearly_fee || 0);

      if (cycle === 'monthly') {
        const billingDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const [ex] = await db.pool.execute(
          'SELECT id FROM billing WHERE society_id = ? AND type = ? AND billing_date = ?',
          [s.id, 'monthly', billingDate]
        );
        if (ex.length === 0 && monthlyFee > 0) {
          const invNum = `INV-${Date.now()}-${s.id}-M`;
          const [ins] = await db.pool.execute(
            `INSERT INTO billing (society_id, amount, type, billing_date, due_date, payment_status, invoice_number, notes)
             VALUES (?, ?, 'monthly', ?, ?, 'pending', ?, ?)`,
            [s.id, monthlyFee, billingDate, billingDate, invNum, `Monthly ${MONTHS[month - 1]} ${year}`]
          );
          created++;
          const societyName = s.name || 'Your society';
          const title = `New invoice: ${societyName} — ${MONTHS[month - 1]} ${year}`;
          const body = `Amount: ₹${Number(monthlyFee).toLocaleString('en-IN')}. Due date: ${formatDueDate(billingDate)}. View and pay in Dashboard → Invoices & Payments.`;
          await notifySocietyAdmins(s.id, 'invoice_generated', title, body, ins.insertId);
        }
      } else if (cycle === 'quarterly') {
        const quarter = Math.ceil(month / 3);
        const quarterEndMonth = quarter * 3;
        const billingDate = `${year}-${String(quarterEndMonth).padStart(2, '0')}-01`;
        const [ex] = await db.pool.execute(
          'SELECT id FROM billing WHERE society_id = ? AND type = ? AND YEAR(billing_date) = ? AND MONTH(billing_date) = ?',
          [s.id, 'quarterly', year, quarterEndMonth]
        );
        if (ex.length === 0) {
          const amount = yearlyFee > 0 ? yearlyFee / 4 : monthlyFee * 3;
          if (amount > 0) {
            const invNum = `INV-${Date.now()}-${s.id}-Q${quarter}`;
            const [ins] = await db.pool.execute(
              `INSERT INTO billing (society_id, amount, type, billing_date, due_date, payment_status, invoice_number, notes)
               VALUES (?, ?, 'quarterly', ?, ?, 'pending', ?, ?)`,
              [s.id, amount, billingDate, billingDate, invNum, `Q${quarter} ${year}`]
            );
            created++;
            const societyName = s.name || 'Your society';
            const title = `New invoice: ${societyName} — Q${quarter} ${year}`;
            const body = `Amount: ₹${Number(amount).toLocaleString('en-IN')}. Due date: ${formatDueDate(billingDate)}. View and pay in Dashboard → Invoices & Payments.`;
            await notifySocietyAdmins(s.id, 'invoice_generated', title, body, ins.insertId);
          }
        }
      } else if (cycle === 'yearly' && month === 1) {
        const billingDate = `${year}-01-01`;
        const [ex] = await db.pool.execute(
          'SELECT id FROM billing WHERE society_id = ? AND type = ? AND YEAR(billing_date) = ?',
          [s.id, 'yearly', year]
        );
        if (ex.length === 0) {
          const amount = yearlyFee > 0 ? yearlyFee : monthlyFee * 12;
          if (amount > 0) {
            const invNum = `INV-${Date.now()}-${s.id}-Y`;
            const [ins] = await db.pool.execute(
              `INSERT INTO billing (society_id, amount, type, billing_date, due_date, payment_status, invoice_number, notes)
               VALUES (?, ?, 'yearly', ?, ?, 'pending', ?, ?)`,
              [s.id, amount, billingDate, billingDate, invNum, `Year ${year}`]
            );
            created++;
            const societyName = s.name || 'Your society';
            const title = `New invoice: ${societyName} — Year ${year}`;
            const body = `Amount: ₹${Number(amount).toLocaleString('en-IN')}. Due date: ${formatDueDate(billingDate)}. View and pay in Dashboard → Invoices & Payments.`;
            await notifySocietyAdmins(s.id, 'invoice_generated', title, body, ins.insertId);
          }
        }
      }
    }

    res.json({
      success: true,
      data: { message: `Created ${created} invoice(s) for ${MONTHS[month - 1]} ${year}`, created },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { overview, monthDetail, sendReminder, createOrder, generateRecurring };
