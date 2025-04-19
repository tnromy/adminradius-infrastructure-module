/**
 * Service untuk logging menggunakan Winston
 */

const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');
const config = require('../../config/app.config');
const { getRequestContext } = require('./requestContext.service');
const { generateUUID } = require('../utils/uuid.util');

// Konfigurasi format log
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Konfigurasi Elasticsearch transport
const esTransportOpts = {
  level: 'trace',
  clientOpts: {
    node: config.elasticsearch.node,
    auth: {
      username: config.elasticsearch.auth.username,
      password: config.elasticsearch.auth.password
    }
  },
  indexPrefix: config.elasticsearch.index,
  indexSuffixPattern: 'YYYY.MM.DD'
};

// Buat Winston logger
const logger = winston.createLogger({
  levels: config.logLevels,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      level: 'trace'
    }),
    new ElasticsearchTransport(esTransportOpts)
  ]
});

/**
 * Membuat log entry dengan context yang sesuai
 * @param {string} level - Level log
 * @param {string} message - Pesan log
 * @param {Object} additionalInfo - Informasi tambahan
 */
function createLogEntry(level, message, additionalInfo = {}) {
  const context = getRequestContext();
  const requestId = context?.requestId || generateUUID();
  
  const logData = {
    level,
    message,
    requestId,
    userId: context?.getUserId(),
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };

  logger.log(level, message, logData);
}

// Fungsi helper untuk setiap level log
const logError = (message, additionalInfo) => createLogEntry('error', message, additionalInfo);
const logWarn = (message, additionalInfo) => createLogEntry('warn', message, additionalInfo);
const logInfo = (message, additionalInfo) => createLogEntry('info', message, additionalInfo);
const logHttp = (message, additionalInfo) => createLogEntry('http', message, additionalInfo);
const logDebug = (message, additionalInfo) => createLogEntry('debug', message, additionalInfo);
const logTrace = (message, additionalInfo) => createLogEntry('trace', message, additionalInfo);

/**
 * Middleware untuk logging HTTP requests
 */
function requestLoggingMiddleware(req, res, next) {
  const requestId = generateUUID();
  const context = getRequestContext();
  
  // Set request ID ke context
  context.setRequestId(requestId);
  
  // Tambahkan request ID ke response header
  res.setHeader('X-Request-ID', requestId);
  
  const startTime = Date.now();
  
  // Log request
  logHttp('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  });

  // Intercept response
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Log response
    logHttp('Response sent', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      responseBody: body
    });

    originalSend.call(this, body);
  };

  next();
}

// Helper untuk membuat error response yang konsisten
function createErrorResponse(status, message, error = null) {
  const context = getRequestContext();
  const requestId = context.getRequestId();
  
  const response = {
    error: message,
    request_id: requestId
  };

  if (error && process.env.NODE_ENV !== 'production') {
    response.details = error.message;
  }

  return response;
}

module.exports = {
  logger,
  logError,
  logWarn,
  logInfo,
  logHttp,
  logDebug,
  logTrace,
  requestLoggingMiddleware,
  createErrorResponse
}; 