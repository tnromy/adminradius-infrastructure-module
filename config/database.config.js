/**
 * Konfigurasi database dari environment variables
 */
require('dotenv').config();

module.exports = {
  // Connection URI
  uri: process.env.MONGODB_URI,
  
  // Connection configuration
  options: {
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '5'),
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50'),
    autoIndex: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true
  },
  
  // Connection parameters
  host: process.env.MONGO_HOST,
  port: process.env.MONGO_PORT,
  user: process.env.MONGO_USER,
  
  // Database name
  database: process.env.MONGO_DATABASE || 'adminradius'
}; 