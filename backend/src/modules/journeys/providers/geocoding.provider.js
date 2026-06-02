const axios = require("axios");
const env = require("../../../config/env");

async function getAddressFromCoordinates(lat, lng) {
  if (!env.googleMapsApiKey) {
    const error = new Error("GOOGLE_MAPS_API_KEY não configurada.");
    error.statusCode = 500;
    throw error;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${env.googleMapsApiKey}&language=pt-BR`;

  try {
    const response = await axios.get(url);

    if (response.data.status === "ZERO_RESULTS") {
      return "Localização não identificada";
    }

    if (response.data.status !== "OK") {
      throw new Error(response.data.error_message || "Erro ao consultar Geocoding API");
    }

    // Retorna o primeiro endereço formatado (o mais preciso)
    return response.data.results[0].formatted_address;
  } catch (error) {
    console.error("Erro Geocoding Provider:", error.message);
    return "Localização não identificada";
  }
}

/**
 * Resolve um endereço a partir de texto (Forward Geocoding)
 * @param {string} address - Texto do endereço para buscar
 */
async function geocodeAddress(address) {
  if (!env.googleMapsApiKey) {
    const error = new Error("GOOGLE_MAPS_API_KEY não configurada.");
    error.statusCode = 500;
    throw error;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${env.googleMapsApiKey}&language=pt-BR&region=br`;

  try {
    const response = await axios.get(url);

    if (response.data.status === "ZERO_RESULTS" || !response.data.results || response.data.results.length === 0) {
      return [];
    }

    if (response.data.status !== "OK") {
      throw new Error(response.data.error_message || "Erro ao consultar Geocoding API");
    }

    return response.data.results.map(result => {
      const isUberaba = result.address_components.some(c => c.long_name === "Uberaba");
      let type = "unknown";
      if (result.types.includes("street_address")) type = "street_address";
      else if (result.types.includes("route")) type = "street";
      else if (result.types.includes("sublocality")) type = "neighborhood";
      
      // Tentativa de separar o nome da rua para o UI
      const routeComponent = result.address_components.find(c => c.types.includes("route"));
      const numberComponent = result.address_components.find(c => c.types.includes("street_number"));
      
      let name = result.formatted_address.split(",")[0];
      if (routeComponent) {
        name = routeComponent.long_name;
        if (numberComponent) name += `, ${numberComponent.long_name}`;
      }

      let confidence = isUberaba ? "high" : "low";
      if (isUberaba && type === "street") confidence = "medium"; // Rua sem número
      if (isUberaba && type === "neighborhood") confidence = "medium"; // Apenas bairro

      return {
        id: result.place_id,
        name: name,
        address: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        type: type,
        confidence: confidence,
        source: "GOOGLE_GEOCODING",
        isUberaba: isUberaba
      };
    });
  } catch (error) {
    console.error("[Geocoding Provider] Erro no geocodeAddress:", error.message);
    return [];
  }
}

module.exports = {
  getAddressFromCoordinates,
  geocodeAddress
};
