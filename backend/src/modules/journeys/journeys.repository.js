const prisma = require("../../config/prisma");

async function findCachedRoute(cacheKey) {
  return await prisma.routeCache.findFirst({
    where: {
      cacheKey,
      expiresAt: {
        gt: new Date(),
      },
    },
  });
}

async function createRouteCache({ cacheKey, googleResponse, timePreference, durationMinutes = 10 }) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

  return await prisma.routeCache.upsert({
    where: { cacheKey },
    update: {
      googleResponse,
      timePreference,
      expiresAt,
      createdAt: new Date(),
    },
    create: {
      cacheKey,
      googleResponse,
      timePreference,
      expiresAt,
    },
  });
}

async function cleanExpiredCache() {
  return await prisma.routeCache.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}

module.exports = {
  findCachedRoute,
  createRouteCache,
  cleanExpiredCache,
};
