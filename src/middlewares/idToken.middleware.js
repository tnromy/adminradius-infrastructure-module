/**
 * Middleware untuk validasi ID token
 */

const jwt = require('jsonwebtoken');
const config = require('../../config/app.config');
const { getRequestContext } = require('../services/requestContext.service');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');

/**
 * Middleware untuk memvalidasi ID token dan mengekstrak informasi user
 */
async function validateIdToken(req, res, next) {
  const context = getRequestContext();
  const idToken = req.body.id_token;

  logDebug('Memulai validasi ID token', {
    requestId: context.getRequestId(),
    method: req.method,
    path: req.path
  });

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

    // Decode token untuk mendapatkan kid
    const decodedToken = jwt.decode(idToken, { complete: true });
    if (!decodedToken || !decodedToken.header || !decodedToken.header.kid) {
      logWarn('ID token tidak valid', {
        requestId: context.getRequestId()
      });
      return res.status(401).json(createErrorResponse(
        401,
        'Unauthorized - Invalid ID token format'
      ));
    }

    // Dapatkan public key dari JWKS
    const key = await global.JWKS_CLIENT.getSigningKey(decodedToken.header.kid);
    const publicKey = key.getPublicKey();
    
    // Verifikasi token
    const verified = jwt.verify(idToken, publicKey, {
      issuer: config.auth.issuer,
      audience: config.auth.audience
    });

    // Validasi sub dengan user_id dari access token
    if (verified.sub !== context.getUserId()) {
      logWarn('ID token sub tidak sesuai dengan access token', {
        requestId: context.getRequestId(),
        idTokenSub: verified.sub,
        accessTokenSub: context.getUserId()
      });
      return res.status(401).json(createErrorResponse(
        401,
        'Unauthorized - ID token subject mismatch'
      ));
    }

    // Simpan informasi user ke request
    req.userInfo = {
      name: verified.name,
      email: verified.email,
      phone: verified.phone_number,
      picture: verified.picture
    };

    logInfo('ID token berhasil divalidasi', {
      requestId: context.getRequestId(),
      userId: verified.sub,
      name: verified.name,
      email: verified.email
    });

    next();
  } catch (error) {
    logError('Error pada validasi ID token', {
      requestId: context.getRequestId(),
      error: error.message,
      stack: error.stack
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(createErrorResponse(
        401,
        'Unauthorized - ID token expired'
      ));
    }
    
    return res.status(401).json(createErrorResponse(
      401,
      'Unauthorized - Invalid ID token'
    ));
  }
}

module.exports = {
  validateIdToken
}; 