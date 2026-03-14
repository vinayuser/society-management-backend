const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const emailService = require('../services/emailService');
const { getOnboardingLogoRelativeUrl } = require('../middleware/upload');

async function createInvite(req, res, next) {
  try {
    const {
      societyName,
      contactEmail,
      contactPhone,
      flatCount,
      planType,
      setupFee,
      monthlyFee,
      address,
    } = req.body;

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

    await db.pool.execute(
      `INSERT INTO society_invites (society_name, email, phone, flat_count, plan_type, setup_fee, monthly_fee, address, invite_token, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        societyName,
        contactEmail,
        contactPhone || '',
        flatCount || 0,
        planType || config.planTypes.SHARED_APP,
        setupFee || 0,
        monthlyFee || 0,
        address || null,
        inviteToken,
        expiresAt,
      ]
    );

    const inviteUrl = `${config.platform.inviteBaseUrl}/${inviteToken}`;
    await emailService.sendInviteEmail(contactEmail, societyName, inviteUrl);

    res.status(201).json({
      success: true,
      data: {
        inviteToken,
        inviteUrl,
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
      `SELECT id, society_name, email, phone, flat_count, plan_type, setup_fee, monthly_fee, address, invite_token, status, expires_at, created_at
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
    res.json({
      success: true,
      data: {
        societyName: invite.society_name,
        email: invite.email,
        phone: invite.phone,
        flatCount: invite.flat_count,
        planType: invite.plan_type,
        setupFee: parseFloat(invite.setup_fee),
        monthlyFee: parseFloat(invite.monthly_fee),
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

    let societyId;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [socResult] = await conn.execute(
        `INSERT INTO societies (name, alias, email, phone, flat_count, plan_type, setup_fee, monthly_fee, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'onboarding_completed')`,
        [
          invite.society_name,
          finalAlias,
          invite.email,
          invite.phone,
          totalFlats ?? invite.flat_count,
          invite.plan_type,
          invite.setup_fee,
          invite.monthly_fee,
        ]
      );
      societyId = socResult.insertId;

      // Single society address: use body address or invite address (same value used everywhere)
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
        const [userResult] = await conn.execute(
          `INSERT INTO users (society_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'society_admin')`,
          [societyId, adminContactName || 'Society Admin', adminEmail, passwordHash]
        );
      }

      await conn.execute(
        'UPDATE society_invites SET status = ? WHERE id = ?',
        ['accepted', invite.id]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    res.status(201).json({
      success: true,
      data: {
        societyId,
        alias: finalAlias,
        message: 'Onboarding completed. Society can be activated by Super Admin.',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function listInvites(req, res, next) {
  try {
    const [rows] = await db.pool.execute(
      `SELECT id, society_name, email, phone, flat_count, plan_type, setup_fee, monthly_fee, address, invite_token, status, expires_at, created_at
       FROM society_invites ORDER BY created_at DESC`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyName: r.society_name,
        email: r.email,
        phone: r.phone,
        flatCount: r.flat_count,
        planType: r.plan_type,
        setupFee: parseFloat(r.setup_fee),
        monthlyFee: parseFloat(r.monthly_fee),
        address: r.address || '',
        inviteToken: r.invite_token,
        status: r.status,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
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

module.exports = {
  createInvite,
  getInviteByToken,
  uploadLogo,
  acceptInvite,
  listInvites,
  resendInvite,
};
