const db = require('../config/database');
const { getMemberDocumentRelativeUrl } = require('../middleware/upload');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const [rows] = await db.pool.execute(
      'SELECT id, society_id, member_id, document_name, document_type, file_url, uploaded_at FROM member_documents WHERE society_id = ? AND member_id = ? ORDER BY uploaded_at DESC',
      [societyId, memberId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id, memberId: r.member_id, documentName: r.document_name, documentType: r.document_type, fileUrl: r.file_url, uploadedAt: r.uploaded_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const { documentName, documentType } = req.body;
    if (!req.file || !req.file.filename) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const fileUrl = getMemberDocumentRelativeUrl(societyId, req.file.filename);
    const name = documentName || req.file.originalname || 'Document';
    const [result] = await db.pool.execute(
      'INSERT INTO member_documents (society_id, member_id, document_name, document_type, file_url) VALUES (?, ?, ?, ?, ?)',
      [societyId, memberId, name, documentType || null, fileUrl]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId, memberId: Number(memberId), documentName: name, documentType: documentType || null, fileUrl, uploadedAt: new Date(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const docId = req.params.docId;
    const [result] = await db.pool.execute('DELETE FROM member_documents WHERE id = ? AND member_id = ? AND society_id = ?', [docId, memberId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
