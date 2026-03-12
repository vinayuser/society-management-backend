const db = require('../config/database');
const { getRelativeUrl } = require('../middleware/upload');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapDoc(r) {
  return {
    id: r.id,
    guardId: r.guard_id,
    societyId: r.society_id,
    documentName: r.document_name,
    documentType: r.document_type,
    fileUrl: r.file_url,
    expiryDate: r.expiry_date,
    uploadedAt: r.uploaded_at,
  };
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const [rows] = await db.pool.execute(
      `SELECT id, guard_id, society_id, document_name, document_type, file_url, expiry_date, uploaded_at
       FROM guard_documents WHERE society_id = ? AND guard_id = ? ORDER BY uploaded_at DESC`,
      [societyId, guardId]
    );
    res.json({ success: true, data: rows.map(mapDoc) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { documentName, documentType, expiryDate } = req.body;
    if (!req.file || !req.file.filename) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const [guardCheck] = await db.pool.execute('SELECT 1 FROM guards WHERE id = ? AND society_id = ?', [guardId, societyId]);
    if (!guardCheck.length) {
      return res.status(404).json({ success: false, message: 'Guard not found' });
    }
    const fileUrl = getRelativeUrl(societyId, 'documents', req.file.filename);
    const name = documentName || req.file.originalname || 'Document';
    const [result] = await db.pool.execute(
      `INSERT INTO guard_documents (guard_id, society_id, document_name, document_type, file_url, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [guardId, societyId, name, documentType || null, fileUrl, expiryDate || null]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        guardId: Number(guardId),
        societyId,
        documentName: name,
        documentType: documentType || null,
        fileUrl,
        expiryDate: expiryDate || null,
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
    const guardId = req.params.guardId || req.params.id;
    const { docId } = req.params;
    const [result] = await db.pool.execute(
      'DELETE FROM guard_documents WHERE id = ? AND guard_id = ? AND society_id = ?',
      [docId, guardId, societyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
