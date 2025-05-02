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

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    credentials: true
  },

  auth: {
    jwksUrl: process.env.JWKS_URL,
    jwtIssuer: process.env.JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE,
    allowedRoles: ['Client Owner', 'Client Administrator']
  },

  // Elasticsearch configuration
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE,
    index: process.env.ELASTICSEARCH_INDEX,
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD
    }
  },

  // Log levels
  logLevels: {
    error: 0,    // Error conditions
    warn: 1,     // Warning conditions
    info: 2,     // Informational messages
    http: 3,     // HTTP request logs
    debug: 4,    // Debug messages
    trace: 5     // Trace messages
  }
};
