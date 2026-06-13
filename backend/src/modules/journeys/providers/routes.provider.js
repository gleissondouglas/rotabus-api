const googleRoutesProvider = require("./googleRoutes.provider");

/**
 * Provedor agnóstico para cálculo de rotas.
 * Abstrai a dependência direta de vendors específicos (ex: Google).
 */
async function computeTransitRoute({ origin, destination, timePreference }) {
  return googleRoutesProvider.computeTransitRoute({ origin, destination, timePreference });
}

async function computeWalkingRoute({ origin, destination }) {
  return googleRoutesProvider.computeWalkingRoute({ origin, destination });
}

module.exports = {
  computeTransitRoute,
  computeWalkingRoute,
};
