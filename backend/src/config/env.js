require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    googleMapsApiKey: process.env.GOOGLE_MAPS_BACKEND_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
};