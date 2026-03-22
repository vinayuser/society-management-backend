const locationsService = require('../services/locationsService');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

async function listCountries(req, res, next) {
  try {
    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 100, maxLimit: 500 });
    const countries = await locationsService.listCountries();
    const mapped = countries.map((c) => ({ id: c.id, iso2: c.iso2, name: c.name }));
    jsonCollection(res, mapped.slice(offset, offset + limit), { page, limit, total: mapped.length });
  } catch (err) {
    next(err);
  }
}

async function listStates(req, res, next) {
  try {
    const { countryId } = req.query;
    if (countryId == null || String(countryId).trim() === '') {
      return res.status(400).json({ success: false, message: 'countryId is required' });
    }
    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 100, maxLimit: 500 });
    const states = await locationsService.listStates(Number(countryId));
    const mapped = states.map((s) => ({ id: s.id, name: s.name, stateCode: s.state_code, isPinned: !!s.is_pinned, pinnedRank: s.pinned_rank }));
    jsonCollection(res, mapped.slice(offset, offset + limit), { page, limit, total: mapped.length });
  } catch (err) {
    next(err);
  }
}

async function listCities(req, res, next) {
  try {
    const { stateId } = req.query;
    if (stateId == null || String(stateId).trim() === '') {
      return res.status(400).json({ success: false, message: 'stateId is required' });
    }
    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 100, maxLimit: 500 });
    const cities = await locationsService.listCities(Number(stateId));
    const mapped = cities.map((c) => ({ id: c.id, name: c.name, cityCode: c.city_code }));
    jsonCollection(res, mapped.slice(offset, offset + limit), { page, limit, total: mapped.length });
  } catch (err) {
    next(err);
  }
}

async function pinState(req, res, next) {
  try {
    const stateId = Number(req.params.id);
    const { isPinned, pinnedRank } = req.body;
    const updated = await locationsService.pinState(stateId, { isPinned, pinnedRank });
    if (!updated) return res.status(404).json({ success: false, message: 'State not found' });
    res.json({
      success: true,
      data: { id: updated.id, name: updated.name, countryId: updated.country_id, isPinned: !!updated.is_pinned, pinnedRank: updated.pinned_rank },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCountries, listStates, listCities, pinState };

