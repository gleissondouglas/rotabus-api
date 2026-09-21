require("dotenv").config();

const GOOGLE_MAPS_ANDROID_API_KEY =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY || "";

const GOOGLE_MAPS_IOS_API_KEY = process.env.GOOGLE_MAPS_IOS_API_KEY || "";

module.exports = {
  expo: {
    name: "RotaBus",
    slug: "rotaBus-front",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "rotaBusfront",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.rotaBus-front",
      config: {
        googleMapsApiKey: GOOGLE_MAPS_IOS_API_KEY,
      },
      infoPlist: {
        NSSpeechRecognitionUsageDescription:
          "O RotaBus usa reconhecimento de fala para entender o destino informado por voz.",
        NSMicrophoneUsageDescription:
          "O RotaBus usa o microfone para ouvir o destino informado por voz.",
        NSLocationWhenInUseUsageDescription:
          "O RotaBus precisa da sua localização para encontrar os pontos de ônibus mais próximos.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: "com.gleissondouglas.rotaBus",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
      ],
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_ANDROID_API_KEY,
        },
      },
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      "expo-font",
      [
        "@sentry/react-native/expo",
        {
          organization: "rotaBus",
          project: "rotaBus-front",
          disableOnRelease: true,
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      "expo-secure-store",
      "expo-speech-recognition",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.0.21",
            usesCleartextTraffic: process.env.NODE_ENV !== "production",
            memoryMaxHeapSize: "2048M",
          },
          ios: {
            deploymentTarget: "15.1",
          },
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: false,
    },

    extra: {
      router: {},
      eas: {
        projectId: "195e0109-91dd-4336-a8cb-e0fff01bb41e",
      },
      apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000",
      sentryDsn: process.env.SENTRY_DSN || "",
    },
  },
};
