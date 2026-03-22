const db = require('../config/database');
const config = require('../config');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');
const { adsMediaRelativeUrl } = require('../middleware/upload');

const ADS_UPLOAD_SEGMENT = 'platform';

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

/** Expose media URLs as absolute (https://host/...) for clients; pass-through if already absolute. */
function absolutePublicUrl(req, pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === '') return pathOrUrl;
  const s = String(pathOrUrl).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const fromConfig = (config.apiBaseUrl || '').replace(/\/$/, '');
  const fromReq = req && req.get && req.protocol ? `${req.protocol}://${req.get('host')}` : '';
  const base = fromConfig || fromReq;
  if (!base) return s;
  const p = s.startsWith('/') ? s : `/${s}`;
  return `${base}${p}`;
}

async function list(req, res, next) {
  try {
    const visibleOnly = String(req.query.visibleOnly) === '1' || String(req.query.visibleOnly).toLowerCase() === 'true';
    const isSuper = req.user.role === config.roles.SUPER_ADMIN;
    const querySocietyId =
      req.query.societyId != null && String(req.query.societyId).trim() !== '' ? Number(req.query.societyId) : null;

    if (!visibleOnly && !isSuper) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let sql = `SELECT id, society_id, type, content_url, title, start_date, end_date, is_active, created_at FROM ads WHERE 1=1`;
    const params = [];

    if (visibleOnly) {
      sql += ' AND is_active = 1 AND CURDATE() BETWEEN start_date AND end_date';
    }

    if (isSuper && querySocietyId != null && Number.isFinite(querySocietyId)) {
      sql += ' AND society_id = ?';
      params.push(querySocietyId);
    }

    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 20, maxLimit: 100 });
    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS ads_count`;
    const [countRows] = await db.pool.execute(countSql, params);
    const total = Number(countRows[0]?.total ?? 0);
    sql += ` ORDER BY start_date DESC LIMIT ? OFFSET ?`;
    const [rows] = await db.pool.execute(sql, [...params, limit, offset]);
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        type: r.type,
        contentUrl: absolutePublicUrl(req, r.content_url),
        title: r.title,
        startDate: r.start_date,
        endDate: r.end_date,
        isActive: !!r.is_active,
        createdAt: r.created_at,
      })),
      { page, limit, total }
    );
  } catch (err) {
    next(err);
  }
}

function parseBool(v, defaultVal = true) {
  if (v === undefined || v === null || v === '') return defaultVal;
  if (v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false') return false;
  return true;
}

function normalizeType(t) {
  const s = t != null ? String(t).toLowerCase() : 'banner';
  if (s === 'banner' || s === 'video' || s === 'promotion') return s;
  return 'banner';
}

function validateAdDates(startDate, endDate) {
  if (!startDate || !endDate) return 'Start and end dates are required';
  return null;
}

async function create(req, res, next) {
  try {
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const type = normalizeType(req.body.type);
    const title = req.body.title != null && String(req.body.title).trim() !== '' ? String(req.body.title).trim() : null;
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    const dateErr = validateAdDates(startDate, endDate);
    if (dateErr) return res.status(400).json({ success: false, message: dateErr });

    let contentUrl = req.body.contentUrl != null ? String(req.body.contentUrl).trim() : '';
    if (req.file) {
      contentUrl = adsMediaRelativeUrl(ADS_UPLOAD_SEGMENT, req.file.filename);
    }
    if (!contentUrl) {
      return res.status(400).json({ success: false, message: 'Provide a media URL or upload a file' });
    }

    const isActive = parseBool(req.body.isActive, true) ? 1 : 0;
    const [result] = await db.pool.execute(
      'INSERT INTO ads (society_id, type, content_url, title, start_date, end_date, is_active) VALUES (NULL, ?, ?, ?, ?, ?, ?)',
      [type, contentUrl, title, startDate, endDate, isActive]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId: null,
        type,
        contentUrl: absolutePublicUrl(req, contentUrl),
        title,
        startDate,
        endDate,
        isActive: !!isActive,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { id } = req.params;
    const [existing] = await db.pool.execute('SELECT id, society_id, content_url FROM ads WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    const updates = [];
    const values = [];

    if (req.file) {
      updates.push('content_url = ?');
      values.push(adsMediaRelativeUrl(ADS_UPLOAD_SEGMENT, req.file.filename));
    } else if (req.body.contentUrl !== undefined) {
      const u = String(req.body.contentUrl).trim();
      if (u) {
        updates.push('content_url = ?');
        values.push(u);
      }
    }

    if (req.body.type !== undefined) {
      updates.push('type = ?');
      values.push(normalizeType(req.body.type));
    }
    if (req.body.title !== undefined) {
      updates.push('title = ?');
      values.push(req.body.title != null && String(req.body.title).trim() !== '' ? String(req.body.title).trim() : null);
    }
    if (req.body.startDate !== undefined) {
      updates.push('start_date = ?');
      values.push(req.body.startDate);
    }
    if (req.body.endDate !== undefined) {
      updates.push('end_date = ?');
      values.push(req.body.endDate);
    }
    if (req.body.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(parseBool(req.body.isActive, true) ? 1 : 0);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    const [r] = await db.pool.execute(`UPDATE ads SET ${updates.join(', ')} WHERE id = ?`, values);
    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    res.json({ success: true, message: 'Advertisement updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM ads WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    res.json({ success: true, message: 'Ad deleted' });
  } catch (err) {
    next(err);
  }
}

function uploadMedia(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  const rel = adsMediaRelativeUrl(req.adsUploadSegment || ADS_UPLOAD_SEGMENT, req.file.filename);
  res.json({
    success: true,
    data: { url: absolutePublicUrl(req, rel), mimetype: req.file.mimetype },
  });
}

module.exports = { list, create, update, remove, uploadMedia };
