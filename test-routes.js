const axios = require('axios');
const env = require('./backend/src/config/env');

async function test() {
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const body = {
    origin: { address: 'Rua Segismundo Mendes, Uberaba' },
    destination: { address: 'Terminal Leste, Uberaba' },
    travelMode: "TRANSIT",
  };
  
  try {
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.googleMapsApiKey,
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.distanceMeters",
          "routes.polyline",
          "routes.localizedValues",
          "routes.legs.steps.travelMode",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.staticDuration",
          "routes.legs.steps.polyline",
          "routes.legs.steps.startLocation",
          "routes.legs.steps.endLocation",
          "routes.legs.steps.navigationInstruction",
          // SPECIFY SUBFIELDS INSTEAD OF PARENT
          "routes.legs.steps.steps.travelMode",
          "routes.legs.steps.steps.distanceMeters",
          "routes.legs.steps.steps.staticDuration",
          "routes.legs.steps.steps.polyline",
          "routes.legs.steps.steps.startLocation",
          "routes.legs.steps.steps.endLocation",
          "routes.legs.steps.steps.navigationInstruction",
          "routes.legs.steps.transitDetails"
        ].join(",")
      }
    });
    console.log("Success:", !!response.data.routes);
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}
test();