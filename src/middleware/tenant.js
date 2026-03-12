const db = require('../config/database');

/**
 * Resolves tenant (society) from:
 * 1. Subdomain: greenvalley.platform.com -> alias = greenvalley
 * 2. Path: /greenvalley/... or ?alias=greenvalley
 * 3. Header: X-Society-Alias: greenvalley
 * Sets req.societyId and req.societyAlias for downstream use.
 */
async function resolveTenant(req, res, next) {
  let alias = null;

  const host = req.get('host') || '';
  const pathAlias = req.params.alias || req.query.alias;
  const headerAlias = req.get('x-society-alias');

  if (headerAlias) {
    alias = headerAlias.trim().toLowerCase();
  } else if (pathAlias) {
    alias = String(pathAlias).trim().toLowerCase();
  } else if (host.includes('.')) {
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      alias = subdomain.toLowerCase();
    }
  }

  if (!alias) {
    req.societyId = null;
    req.societyAlias = null;
    return next();
  }

  try {
    const [rows] = await db.pool.execute(
      'SELECT id, alias, name, status FROM societies WHERE alias = ? LIMIT 1',
      [alias]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Society not found' });
    }
    const society = rows[0];
    if (society.status !== 'active' && society.status !== 'onboarding_completed') {
      return res.status(403).json({ success: false, message: 'Society is not active' });
    }
    req.societyId = society.id;
    req.societyAlias = society.alias;
    req.society = society;
    next();
  } catch (err) {
    next(err);
  }
}

/** Require tenant to be resolved (for tenant-scoped routes). */
function requireTenant(req, res, next) {
  if (!req.societyId) {
    return res.status(400).json({ success: false, message: 'Society alias required' });
  }
  next();
}

/** Scope request to user's society (from JWT). Use after authenticate. */
function scopeToUserSociety(req, res, next) {
  if (req.user && req.user.societyId) {
    req.societyId = req.user.societyId;
  }
  next();
}

module.exports = { resolveTenant, requireTenant, scopeToUserSociety };
