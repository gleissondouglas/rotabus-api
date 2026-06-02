import * as Location from "expo-location";

async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

async function getCurrentLocation() {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = location.coords;

    console.log(`[LocationService] Localização obtida via GPS: ${latitude}, ${longitude}`);

    return {
      latitude,
      longitude,
    };
  } catch (error) {
    console.log("[LocationService] Erro ao obter localização real:", error);
    
    if (__DEV__) {
      console.log("[LocationService] Ambiente de desenvolvimento. Usando Uberaba como fallback de erro.");
      return {
        latitude: -19.7472,
        longitude: -47.9392,
      };
    }
    
    throw error;
  }
}

async function geocodeAddress(address: string) {
  try {
    const results = await Location.geocodeAsync(address);
    if (results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    }
    return null;
  } catch (error) {
    console.log("Erro ao geocodificar endereço:", error);
    return null;
  }
}

export const locationService = {
  requestLocationPermission,
  getCurrentLocation,
  geocodeAddress,
};
