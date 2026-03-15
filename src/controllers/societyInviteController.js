const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const emailService = require('../services/emailService');
const { getOnboardingLogoRelativeUrl } = require('../middleware/upload');

async function createInvite(req, res, next) {
  try {
    let {
      societyName,
      contactEmail,
      contactPhone,
      flatCount,
      planType,
      planId,
      setupFee,
      monthlyFee,
      billingCycle,
      yearlyFee,
      address,
    } = req.body;

    if (planId) {
      const [plans] = await db.pool.execute(
        'SELECT id, monthly_fee, yearly_fee, billing_cycle FROM society_plans WHERE id = ? AND is_active = 1',
        [planId]
      );
      if (plans.length) {
        const p = plans[0];
        monthlyFee = parseFloat(p.monthly_fee);
        yearlyFee = parseFloat(p.yearly_fee);
        billingCycle = (p.billing_cycle || 'monthly').toLowerCase();
      }
    }

    const alias = societyName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
    const aliasBase = alias || 'society';
    let finalAlias = aliasBase;
    let counter = 1;
    let existing = await db.query('SELECT id FROM societies WHERE alias = ?', [finalAlias]);
    while (existing.length) {
      finalAlias = `${aliasBase}${counter}`;
      counter++;
      existing = await db.query('SELECT id FROM societies WHERE alias = ?', [finalAlias]);
    }

    const inviteToken = uuidv4().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const cycle = (billingCycle || 'monthly').toLowerCase();
    const yFee = parseFloat(yearlyFee) || 0;
    const setupFeeAmount = parseFloat(setupFee) || 0;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [invResult] = await conn.execute(
        `INSERT INTO society_invites (society_name, email, phone, flat_count, plan_type, plan_id, setup_fee, monthly_fee, billing_cycle, yearly_fee, address, invite_token, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          societyName,
          contactEmail,
          contactPhone || '',
          flatCount || 0,
          planType || config.planTypes.SHARED_APP,
          planId || null,
          setupFeeAmount,
          parseFloat(monthlyFee) || 0,
          cycle,
          yFee,
          address || null,
          inviteToken,
          expiresAt,
        ]
      );
      const inviteId = invResult.insertId;

      if (setupFeeAmount > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const invNum = `SETUP-INV-${Date.now()}-${inviteId}`;
        await conn.execute(
          `INSERT INTO billing (society_id, invite_id, amount, type, billing_date, due_date, payment_status, invoice_number, notes)
           VALUES (NULL, ?, ?, 'setup', ?, ?, 'pending', ?, ?)`,
          [inviteId, setupFeeAmount, today, today, invNum, 'One-time setup fee (invite)']
        );
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const baseUrl = (config.platform.inviteBaseUrl || '').replace(/\/$/, '');
    const linkOnboarding = `${baseUrl}/${inviteToken}`;
    const linkSetupFee = setupFeeAmount > 0 ? `${linkOnboarding}?step=setup_fee` : null;
    const inviteUrl = linkOnboarding;
    await emailService.sendInviteEmail(contactEmail, societyName, inviteUrl);

    res.status(201).json({
      success: true,
      data: {
        inviteToken,
        inviteUrl: linkOnboarding,
        linkSetupFee: linkSetupFee || undefined,
        linkOnboarding,
        expiresAt,
        alias: finalAlias,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function uploadLogo(req, res, next) {
  try {
    const { token } = req.params;
    if (!req.file || !req.file.filename) {
      return res.status(400).json({ success: false, message: 'No logo file uploaded' });
    }
    const [rows] = await db.pool.execute(
      'SELECT id FROM society_invites WHERE invite_token = ? AND status = ?',
      [token, 'pending']
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Invitation not found or expired' });
    }
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const relativePath = getOnboardingLogoRelativeUrl(token, req.file.filename);
    const logoUrl = base + (relativePath.startsWith('/') ? relativePath : '/' + relativePath);
    res.json({
      success: true,
      data: { logoUrl },
    });
  } catch (err) {
    next(err);
  }
}

async function getInviteByToken(req, res, next) {
  try {
    const { token } = req.params;
    const [rows] = await db.pool.execute(
      `SELECT id, society_name, email, phone, flat_count, plan_type, plan_id, setup_fee, monthly_fee, billing_cycle, yearly_fee, address, invite_token, status, expires_at, created_at
       FROM society_invites WHERE invite_token = ? AND status = 'pending'`,
      [token]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Invitation not found or expired' });
    }
    const invite = rows[0];
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Invitation has expired' });
    }
    let planName = null;
    if (invite.plan_id) {
      const [p] = await db.pool.execute('SELECT name FROM society_plans WHERE id = ?', [invite.plan_id]);
      if (p.length) planName = p[0].name;
    }
    const setupFeeAmount = parseFloat(invite.setup_fee) || 0;
    let setupFeePaid = false;
    let setupFeeBillingId = null;
    if (setupFeeAmount > 0) {
      const [setupBilling] = await db.pool.execute(
        'SELECT id, payment_status FROM billing WHERE invite_id = ? AND type = ? LIMIT 1',
        [invite.id, 'setup']
      );
      if (setupBilling.length) {
        setupFeePaid = setupBilling[0].payment_status === 'paid';
        if (!setupFeePaid) setupFeeBillingId = setupBilling[0].id;
      }
    }
    const baseUrl = (config.platform.inviteBaseUrl || '').replace(/\/$/, '');
    const linkOnboarding = `${baseUrl}/${invite.invite_token}`;
    const linkSetupFee = setupFeeAmount > 0 ? `${linkOnboarding}?step=setup_fee` : null;
    res.json({
      success: true,
      data: {
        societyName: invite.society_name,
        email: invite.email,
        phone: invite.phone,
        flatCount: invite.flat_count,
        planType: invite.plan_type,
        planId: invite.plan_id,
        planName,
        setupFee: setupFeeAmount,
        setupFeePaid,
        setupFeeBillingId,
        linkSetupFee: linkSetupFee || undefined,
        linkOnboarding,
        monthlyFee: parseFloat(invite.monthly_fee),
        billingCycle: (invite.billing_cycle || 'monthly').toLowerCase(),
        yearlyFee: parseFloat(invite.yearly_fee || 0),
        address: invite.address || '',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function acceptInvite(req, res, next) {
  try {
    const { token } = req.params;
    const {
      logo,
      themeColor,
      address,
      bannerImage,
      towersBlocks,
      totalFlats,
      adminContactName,
      adminContactPhone,
      adminEmail,
      adminPassword,
    } = req.body;

    const [invites] = await db.pool.execute(
      'SELECT * FROM society_invites WHERE invite_token = ? AND status = ?',
      [token, 'pending']
    );
    if (!invites.length) {
      return res.status(404).json({ success: false, message: 'Invitation not found or already used' });
    }
    const invite = invites[0];
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Invitation has expired' });
    }

    const alias = invite.society_name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '') || 'society';
    let finalAlias = alias;
    let c = 1;
    let ex = await db.query('SELECT id FROM societies WHERE alias = ?', [finalAlias]);
    while (ex.length) {
      finalAlias = `${alias}${c}`;
      c++;
      ex = await db.query('SELECT id FROM societies WHERE alias = ?', [finalAlias]);
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = adminPassword ? await bcrypt.hash(adminPassword, 10) : null;

    const setupFee = parseFloat(invite.setup_fee) || 0;
    const monthlyFee = parseFloat(invite.monthly_fee) || 0;
    const yearlyFee = parseFloat(invite.yearly_fee) || 0;
    const billingCycle = (invite.billing_cycle || 'monthly').toLowerCase();

    let societyId;
    const pendingBillingIds = [];
    const pendingBillingItems = [];
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [socResult] = await conn.execute(
        `INSERT INTO societies (name, alias, email, phone, flat_count, plan_type, setup_fee, monthly_fee, billing_cycle, yearly_fee, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'onboarding_completed')`,
        [
          invite.society_name,
          finalAlias,
          invite.email,
          invite.phone,
          totalFlats ?? invite.flat_count,
          invite.plan_type,
          invite.setup_fee,
          invite.monthly_fee,
          billingCycle,
          yearlyFee,
        ]
      );
      societyId = socResult.insertId;

      const today = new Date().toISOString().slice(0, 10);
      // Setup fee (if any) is paid separately via invite link ?step=setup_fee; do not create setup billing here.

      const periodAmount = billingCycle === 'yearly' ? (yearlyFee || monthlyFee * 12) : billingCycle === 'quarterly' ? (yearlyFee ? yearlyFee / 4 : monthlyFee * 3) : monthlyFee;
      if (periodAmount > 0) {
        const type = billingCycle === 'yearly' ? 'yearly' : billingCycle === 'quarterly' ? 'quarterly' : 'monthly';
        const m = new Date().getMonth() + 1;
        const y = new Date().getFullYear();
        const billingDate = type === 'yearly' ? `${y}-01-01` : type === 'quarterly' ? `${y}-${String(Math.ceil(m / 3) * 3).padStart(2, '0')}-01` : today.slice(0, 7) + '-01';
        const invNum = `FP-${type}-${Date.now()}-${societyId}`;
        const label = type === 'yearly' ? 'First year' : type === 'quarterly' ? 'First quarter' : 'First month';
        const [fpResult] = await conn.execute(
          `INSERT INTO billing (society_id, amount, type, billing_date, due_date, payment_status, invoice_number, notes)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [societyId, periodAmount, type, billingDate, billingDate, invNum, `${label} - onboarding`]
        );
        pendingBillingIds.push(fpResult.insertId);
        pendingBillingItems.push({ id: fpResult.insertId, amount: periodAmount, label });
      }

      const societyAddress = address !== undefined && address !== '' ? address : (invite.address || null);
      await conn.execute(
        `INSERT INTO society_config (society_id, logo, theme_color, address, banner_image, towers_blocks, total_flats, admin_contact_name, admin_contact_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          societyId,
          logo || null,
          themeColor || null,
          societyAddress,
          bannerImage || null,
          towersBlocks ? JSON.stringify(towersBlocks) : null,
          totalFlats ?? invite.flat_count,
          adminContactName || null,
          adminContactPhone || null,
        ]
      );

      if (adminEmail && passwordHash) {
        await conn.execute(
          `INSERT INTO users (society_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'society_admin')`,
          [societyId, adminContactName || 'Society Admin', adminEmail, passwordHash]
        );
      }

      await conn.execute(
        'UPDATE society_invites SET status = ?, society_id = ? WHERE id = ?',
        ['accepted', societyId, invite.id]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const totalAmount = pendingBillingItems.reduce((s, i) => s + i.amount, 0);
    const data = {
      societyId,
      alias: finalAlias,
      message: totalAmount > 0
        ? 'Onboarding saved. Pay the amount below to continue.'
        : 'Onboarding completed. Society can be activated by Super Admin.',
    };
    if (pendingBillingIds.length > 0) {
      data.billingIds = pendingBillingIds;
      data.pendingBilling = pendingBillingItems;
      data.totalAmount = totalAmount;
      if (pendingBillingIds.length === 1) {
        data.billingId = pendingBillingIds[0];
        data.setupAmount = totalAmount;
      }
    }
    res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function listInvites(req, res, next) {
  try {
    const [rows] = await db.pool.execute(
      `SELECT i.id, i.society_name, i.email, i.phone, i.flat_count, i.plan_type, i.plan_id, i.setup_fee, i.monthly_fee, i.billing_cycle, i.yearly_fee, i.address, i.invite_token, i.status, i.expires_at, i.created_at,
        p.name as plan_name
       FROM society_invites i
       LEFT JOIN society_plans p ON p.id = i.plan_id
       ORDER BY i.created_at DESC`
    );
    const baseUrl = (config.platform.inviteBaseUrl || '').replace(/\/$/, '');
    const inviteIdsWithSetup = rows.filter((r) => parseFloat(r.setup_fee) > 0).map((r) => r.id);
    let setupPaidSet = new Set();
    if (inviteIdsWithSetup.length) {
      const [paid] = await db.pool.execute(
        `SELECT invite_id FROM billing WHERE invite_id IN (${inviteIdsWithSetup.map(() => '?').join(',')}) AND type = ? AND payment_status = ?`,
        [...inviteIdsWithSetup, 'setup', 'paid']
      );
      paid.forEach((p) => setupPaidSet.add(p.invite_id));
    }
    res.json({
      success: true,
      data: rows.map((r) => {
        const setupFeeAmount = parseFloat(r.setup_fee) || 0;
        const linkOnboarding = `${baseUrl}/${r.invite_token}`;
        const linkSetupFee = setupFeeAmount > 0 ? `${linkOnboarding}?step=setup_fee` : null;
        return {
          id: r.id,
          societyName: r.society_name,
          email: r.email,
          phone: r.phone,
          flatCount: r.flat_count,
          planType: r.plan_type,
          planId: r.plan_id,
          planName: r.plan_name || null,
          setupFee: setupFeeAmount,
          setupFeePaid: setupFeeAmount > 0 ? setupPaidSet.has(r.id) : null,
          monthlyFee: parseFloat(r.monthly_fee),
          billingCycle: (r.billing_cycle || 'monthly').toLowerCase(),
          yearlyFee: parseFloat(r.yearly_fee || 0),
          address: r.address || '',
          inviteToken: r.invite_token,
          status: r.status,
          linkSetupFee: linkSetupFee || undefined,
          linkOnboarding,
          expiresAt: r.expires_at,
          createdAt: r.created_at,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

async function resendInvite(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await db.pool.execute(
      'SELECT id, society_name, email, invite_token, status, expires_at FROM society_invites WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Invite not found' });
    }
    const invite = rows[0];
    if (invite.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only resend pending invites' });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Invite has expired' });
    }
    const inviteUrl = `${config.platform.inviteBaseUrl}/${invite.invite_token}`;
    await emailService.sendInviteEmail(invite.email, invite.society_name, inviteUrl);
    res.json({
      success: true,
      data: { inviteUrl },
      message: 'Invite email resent',
    });
  } catch (err) {
    next(err);
  }
}

async function createSetupFeeOrder(req, res, next) {
  try {
    const { token } = req.params;
    const [invites] = await db.pool.execute(
      'SELECT id FROM society_invites WHERE invite_token = ? AND status = ?',
      [token, 'pending']
    );
    if (!invites.length) {
      return res.status(404).json({ success: false, message: 'Invitation not found or already used' });
    }
    const inviteId = invites[0].id;
    const [billingRows] = await db.pool.execute(
      `SELECT id, amount FROM billing WHERE invite_id = ? AND type = ? AND payment_status = ? LIMIT 1`,
      [inviteId, 'setup', 'pending']
    );
    if (!billingRows.length) {
      return res.status(400).json({ success: false, message: 'Setup fee already paid or no setup fee for this invite' });
    }
    const row = billingRows[0];
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
      receipt: `setup-fee-inv-${inviteId}-${Date.now()}`,
      notes: { inviteId: String(inviteId), billingId: String(row.id) },
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

async function createSetupOrder(req, res, next) {
  try {
    const { token } = req.params;
    const { billingId, billingIds: billingIdsBody } = req.body || {};
    const ids = Array.isArray(billingIdsBody) && billingIdsBody.length > 0
      ? billingIdsBody
      : billingId != null ? [Number(billingId)] : [];
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'billingId or billingIds required' });
    }

    const [invites] = await db.pool.execute(
      'SELECT id, society_id FROM society_invites WHERE invite_token = ? AND status = ? AND society_id IS NOT NULL',
      [token, 'accepted']
    );
    if (!invites.length) {
      return res.status(404).json({ success: false, message: 'Invalid or expired link' });
    }
    const societyId = invites[0].society_id;

    const placeholders = ids.map(() => '?').join(',');
    const [billingRows] = await db.pool.execute(
      `SELECT id, amount, payment_status FROM billing WHERE id IN (${placeholders}) AND society_id = ? AND payment_status = ?`,
      [...ids, societyId, 'pending']
    );
    if (billingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice(s) not found or already paid' });
    }
    if (billingRows.length !== ids.length) {
      return res.status(400).json({ success: false, message: 'Some invoices not found or already paid' });
    }

    const totalAmount = billingRows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const amountPaise = Math.round(totalAmount * 100);
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
      receipt: `onboard-${societyId}-${Date.now()}`,
      notes: { societyId: String(societyId), billingIds: ids.join(',') },
    });
    for (const row of billingRows) {
      await db.pool.execute('UPDATE billing SET razorpay_order_id = ? WHERE id = ?', [order.id, row.id]);
    }
    res.json({
      success: true,
      data: { orderId: order.id, amount: amountPaise, currency: 'INR', keyId },
    });
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const { token } = req.params;
    const { razorpay_order_id, razorpay_payment_id } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, message: 'razorpay_order_id and razorpay_payment_id required' });
    }
    // Find billing by order_id (either invite-level or society-level)
    const [billingRows] = await db.pool.execute(
      'SELECT id, invite_id, society_id FROM billing WHERE razorpay_order_id = ? AND payment_status = ?',
      [razorpay_order_id, 'pending']
    );
    if (!billingRows.length) {
      return res.status(404).json({ success: false, message: 'Order not found or already paid' });
    }
    // If invite-level (invite_id set), verify token matches that invite
    const row = billingRows[0];
    if (row.invite_id != null) {
      const [inv] = await db.pool.execute('SELECT invite_token FROM society_invites WHERE id = ?', [row.invite_id]);
      if (!inv.length || inv[0].invite_token !== token) {
        return res.status(403).json({ success: false, message: 'Invalid link' });
      }
    } else {
      const [invites] = await db.pool.execute(
        'SELECT society_id FROM society_invites WHERE invite_token = ? AND status = ? AND society_id IS NOT NULL',
        [token, 'accepted']
      );
      if (!invites.length || invites[0].society_id !== row.society_id) {
        return res.status(403).json({ success: false, message: 'Invalid or expired link' });
      }
    }
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(503).json({ success: false, message: 'Razorpay not configured' });
    }
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: keySecret });
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return res.status(400).json({ success: false, message: 'Payment not captured' });
    }
    for (const r of billingRows) {
      await db.pool.execute(
        'UPDATE billing SET payment_status = ?, paid_at = NOW(), razorpay_payment_id = ? WHERE id = ?',
        ['paid', razorpay_payment_id, r.id]
      );
    }
    const isSetupFeeOnly = row.invite_id != null;
    res.json({
      success: true,
      data: {
        message: isSetupFeeOnly
          ? 'Setup fee paid. Use the onboarding link to complete society setup and pay your first period.'
          : 'Payment verified. You can sign in now.',
        setupFeeOnly: isSetupFeeOnly,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createInvite,
  getInviteByToken,
  uploadLogo,
  acceptInvite,
  createSetupFeeOrder,
  createSetupOrder,
  verifyPayment,
  listInvites,
  resendInvite,
};
