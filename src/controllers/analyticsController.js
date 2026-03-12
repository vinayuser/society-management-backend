const db = require('../config/database');

async function dashboard(req, res, next) {
  try {
    const [societies] = await db.pool.execute(
      'SELECT COUNT(*) as total FROM societies WHERE status = ?',
      ['active']
    );
    const [residents] = await db.pool.execute(
      'SELECT COUNT(*) as total FROM residents'
    );
    const [billing] = await db.pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM billing WHERE payment_status = 'paid' AND type = 'monthly' AND MONTH(billing_date) = MONTH(CURRENT_DATE()) AND YEAR(billing_date) = YEAR(CURRENT_DATE())`
    );
    const [allSocieties] = await db.pool.execute(
      'SELECT COUNT(*) as total FROM societies'
    );
    const [newSocietiesThisMonth] = await db.pool.execute(
      `SELECT COUNT(*) as total FROM societies WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`
    );
    const [revenueByMonth] = await db.pool.execute(
      `SELECT DATE_FORMAT(billing_date, '%Y-%m') as month, SUM(amount) as total FROM billing WHERE payment_status = 'paid' GROUP BY DATE_FORMAT(billing_date, '%Y-%m') ORDER BY month DESC LIMIT 12`
    );
    res.json({
      success: true,
      data: {
        totalSocieties: allSocieties[0].total,
        activeSocieties: societies[0].total,
        totalResidents: residents[0].total,
        monthlyRevenue: parseFloat(billing[0].total) || 0,
        newSocietiesThisMonth: newSocietiesThisMonth[0].total,
        revenueByMonth: revenueByMonth.map((r) => ({
          month: r.month,
          total: parseFloat(r.total) || 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };
