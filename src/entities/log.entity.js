/**
 * Entity untuk log
 */

const { generateUUID } = require('../utils/uuid.util');

/**
 * Membuat log entity
 * @param {Object} logData - Data log yang akan dibuat
 * @returns {Object} Log entity
 */
function createLogEntity(logData) {
  const now = new Date();
  
  return {
    _id: generateUUID(),
    timestamp: now.toISOString(),
    level: logData.level,
    message: logData.message,
    context: {
      service: 'infrastructure-service',
      environment: process.env.NODE_ENV || 'development',
      requestId: logData.requestId,
      userId: logData.userId,
      method: logData.method,
      url: logData.url,
      statusCode: logData.statusCode,
      responseTime: logData.responseTime,
      userAgent: logData.userAgent,
      ip: logData.ip
    },
    metadata: logData.metadata || {},
    labels: {
      type: logData.type || 'application',
      component: logData.component || 'general'
    },
    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  createLogEntity
}; 