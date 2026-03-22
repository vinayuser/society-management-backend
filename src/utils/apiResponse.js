const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse page/limit from query. Use for SQL OFFSET/LIMIT (integers only).
 * @param {Record<string, unknown>} query - req.query
 * @param {{ defaultLimit?: number, maxLimit?: number }} [options]
 */
function normalizePageLimit(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const page = Math.max(1, parseInt(String(query.page), 10) || DEFAULT_PAGE);
  let limit = parseInt(String(query.limit), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(maxLimit, limit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Pagination block aligned with workable-backend/common/functions.js
 * @param {{ page: number, limit: number, total: number }} meta
 */
function buildPagination({ page, limit, total }) {
  const n = Number(total);
  const totalRecords = Number.isFinite(n) ? n : 0;
  return {
    current_page: page,
    per_page: limit,
    total_records: totalRecords,
  };
}

/**
 * Standard list success payload: Collection.data + Pagination
 * @param {import('express').Response} res
 * @param {unknown[]} dataArray
 * @param {{ page: number, limit: number, total: number }} paginationMeta
 * @param {Record<string, unknown>} [extra] - merged after Pagination (e.g. unreadCount, billingSummary)
 */
function jsonCollection(res, dataArray, paginationMeta, extra = {}) {
  res.json({
    success: true,
    Collection: { data: Array.isArray(dataArray) ? dataArray : [] },
    Pagination: buildPagination(paginationMeta),
    ...extra,
  });
}

module.exports = {
  normalizePageLimit,
  buildPagination,
  jsonCollection,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
