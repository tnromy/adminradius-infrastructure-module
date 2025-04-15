/**
 * Konfigurasi aplikasi dari environment variables
 */
require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
  },
  
  // Base API path
  api: {
    prefix: '/api',
  },
};
