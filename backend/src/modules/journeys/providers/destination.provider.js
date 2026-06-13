const googlePlacesProvider = require("./googlePlaces.provider");

/**
 * Provedor agnóstico para pesquisa e resolução de destinos.
 * Abstrai a dependência direta de vendors específicos (ex: Google).
 */
async function searchPlaces(query, origin) {
  return googlePlacesProvider.searchPlaces(query, origin);
}

module.exports = {
  searchPlaces,
};
