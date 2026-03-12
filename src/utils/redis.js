const config = require('../config');

let client = null;

async function getRedis() {
  if (!config.redis.enabled) return null;
  if (client) return client;
  try {
    const redis = require('redis');
    client = redis.createClient({ url: config.redis.url });
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
    return client;
  } catch (err) {
    console.warn('Redis not available:', err.message);
    return null;
  }
}

async function cacheGet(key) {
  const c = await getRedis();
  if (!c) return null;
  try {
    const val = await c.get(key);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 3600) {
  const c = await getRedis();
  if (!c) return;
  try {
    await c.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (e) {
    // ignore
  }
}

async function cacheDel(key) {
  const c = await getRedis();
  if (!c) return;
  try {
    await c.del(key);
  } catch (e) {
    // ignore
  }
}

module.exports = { getRedis, cacheGet, cacheSet, cacheDel };
