/**
 * Konfigurasi aplikasi dari environment variables
 */
require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '127.0.0.1',
    env: process.env.NODE_ENV || 'development',
  },
  
  // Base API path
  api: {
    prefix: '/api/infra',
  },

  auth: {
    jwksUrl: process.env.JWKS_URL,
    jwtIssuer: process.env.JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE,
    allowedRoles: ['Client Owner', 'Client Administrator']
  }
};
