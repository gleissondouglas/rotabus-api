const ROUTE_CACHE_TTL_MS = 2 * 60 * 1000;

const routeCache = new Map();

function findCachedRoute(cacheKey) {
  const cachedRoute = routeCache.get(cacheKey);

  if (!cachedRoute) return null;

  if (cachedRoute.expiresAt <= Date.now()) {
    routeCache.delete(cacheKey);
    return null;
  }

  return cachedRoute.value;
}

function createRouteCache({ cacheKey, googleResponse, timePreference }) {
  const cachedRoute = {
    googleResponse,
    timePreference,
  };

  routeCache.set(cacheKey, {
    value: cachedRoute,
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
  });

  return cachedRoute;
}

function clearRouteCache() {
  routeCache.clear();
}

module.exports = {
  ROUTE_CACHE_TTL_MS,
  findCachedRoute,
  createRouteCache,
  clearRouteCache,
};
