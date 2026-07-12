require('dotenv').config();

const defaultMaxAudioBytes = 5 * 1024 * 1024;
const configuredMaxAudioBytes = Number(process.env.MAX_AUDIO_BYTES);
const configuredTracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
const configuredProfilesSampleRate = Number(process.env.SENTRY_PROFILES_SAMPLE_RATE);

function sampleRateOrDefault(value, fallback) {
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

module.exports = {
    port: process.env.PORT || 3000,
    googleMapsApiKey: process.env.GOOGLE_MAPS_BACKEND_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
    persistenceDriver: process.env.PERSISTENCE_DRIVER || 'memory',
    maxAudioBytes: Number.isSafeInteger(configuredMaxAudioBytes) && configuredMaxAudioBytes > 0
        ? configuredMaxAudioBytes
        : defaultMaxAudioBytes,
    sentryTracesSampleRate: sampleRateOrDefault(configuredTracesSampleRate, 0.1),
    sentryProfilesSampleRate: sampleRateOrDefault(configuredProfilesSampleRate, 0),
};
