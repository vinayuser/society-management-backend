const db = require('../config/database');
const { getFlatDocumentRelativeUrl } = require('../middleware/upload');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });
    const { page, limit, offset } = normalizePageLimit(req.query);
    const [[{ total }]] = await db.pool.execute(
      'SELECT COUNT(*) AS total FROM flat_documents WHERE society_id = ? AND flat_id = ?',
      [societyId, flatId]
    );
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, flat_id, document_name, document_type, file_url, uploaded_at FROM flat_documents WHERE society_id = ? AND flat_id = ? ORDER BY uploaded_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [societyId, flatId]
    );
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        flatId: r.flat_id,
        documentName: r.document_name,
        documentType: r.document_type,
        fileUrl: r.file_url,
        uploadedAt: r.uploaded_at,
      })),
      { page, limit, total: total ?? 0 }
    );
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const { documentName, documentType } = req.body;
    if (!req.file || !req.file.filename) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });
    const fileUrl = getFlatDocumentRelativeUrl(societyId, req.file.filename);
    const name = documentName || req.file.originalname || 'Document';
    const [result] = await db.pool.execute(
      'INSERT INTO flat_documents (society_id, flat_id, document_name, document_type, file_url) VALUES (?, ?, ?, ?, ?)',
      [societyId, flatId, name, documentType || null, fileUrl]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        flatId: Number(flatId),
        documentName: name,
        documentType: documentType || null,
        fileUrl,
        uploadedAt: new Date(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const docId = req.params.docId;
    const [result] = await db.pool.execute('DELETE FROM flat_documents WHERE id = ? AND flat_id = ? AND society_id = ?', [docId, flatId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
