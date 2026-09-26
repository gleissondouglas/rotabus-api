const Redis = require("ioredis");
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const isUpstash = redisUrl.includes('upstash.io');

// BullMQ exige "maxRetriesPerRequest: null"
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  family: 0,
  ...(isUpstash || redisUrl.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {}),
});

module.exports = { connection };
