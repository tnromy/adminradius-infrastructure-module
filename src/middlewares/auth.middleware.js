/**
 * Middleware untuk autentikasi dan autorisasi
 */

const { jwtVerify } = require('jose');
const config = require('../../config/app.config');
const { getJwks } = require('../services/jwks.service');
const { getRequestContext } = require('../services/requestContext.service');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

/**
 * Extract token dari header Authorization
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} Token atau null jika tidak valid
 */
function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logWarn('Token tidak ditemukan atau format tidak valid', {
      authHeader: authHeader ? 'Present' : 'Missing'
    });
    return null;
  }
  logDebug('Token berhasil diekstrak');
  return authHeader.split(' ')[1];
}

/**
 * Middleware untuk memvalidasi JWT token
 */
async function authenticateJWT(req, res, next) {
  const context = getRequestContext();
  logDebug('Memulai proses autentikasi JWT', {
    requestId: context.getRequestId(),
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress
  });

  const token = extractToken(req.headers.authorization);
  if (!token) {
    logWarn('Token tidak ditemukan', {
      requestId: context.getRequestId(),
      method: req.method,
      path: req.path
    });
    return res.status(401).json(createErrorResponse(
      401,
      'Unauthorized - No token provided'
    ));
  }

  try {
    if (!global.JWKS_CLIENT) {
      logError('JWKS client tidak tersedia', {
        requestId: context.getRequestId()
      });
      return res.status(500).json(createErrorResponse(
        500,
        'Internal server error - Authentication service unavailable'
      ));
    }

    const decodedToken = jwt.decode(token, { complete: true });
    if (!decodedToken || !decodedToken.header || !decodedToken.header.kid) {
      logWarn('Token tidak valid', {
        requestId: context.getRequestId()
      });
      return res.status(401).json(createErrorResponse(
        401,
        'Unauthorized - Invalid token format'
      ));
    }

    const key = await global.JWKS_CLIENT.getSigningKey(decodedToken.header.kid);
    const publicKey = key.getPublicKey();
    
    const verified = jwt.verify(token, publicKey);
    
    logInfo('Token berhasil diverifikasi', {
      requestId: context.getRequestId(),
      userId: verified.sub,
      roles: verified.roles,
      exp: new Date(verified.exp * 1000).toISOString()
    });

    context.setUserId(verified.sub);
    context.setUserRoles(verified.roles);
    
    next();
  } catch (error) {
    logError('Error pada verifikasi token', {
      requestId: context.getRequestId(),
      error: error.message,
      stack: error.stack
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(createErrorResponse(
        401,
        'Unauthorized - Token expired'
      ));
    }
    
    return res.status(401).json(createErrorResponse(
      401,
      'Unauthorized - Invalid token'
    ));
  }
}

/**
 * Middleware untuk memeriksa role user
 */
function authorizeRoles(allowedRoles) {
  return (req, res, next) => {
    const context = getRequestContext();
    const userRoles = context.getUserRoles();
    
    logDebug('Memeriksa otorisasi roles', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      userRoles: userRoles.map(r => r.name),
      requiredRoles: allowedRoles
    });

    const hasAllowedRole = userRoles.some(role => 
      allowedRoles.includes(role.name)
    );

    if (!hasAllowedRole) {
      logWarn('Akses ditolak - Role tidak mencukupi', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        userRoles: userRoles.map(r => r.name),
        requiredRoles: allowedRoles
      });
      
      return res.status(403).json(createErrorResponse(
        403,
        'Forbidden - Insufficient permissions'
      ));
    }

    next();
  };
}

module.exports = {
  authenticateJWT,
  authorizeRoles
}; 