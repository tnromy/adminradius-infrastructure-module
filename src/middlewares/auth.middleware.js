/**
 * Middleware untuk autentikasi dan autorisasi
 */

const { jwtVerify } = require('jose');
const config = require('../../config/app.config');
const { getJwks } = require('../services/jwks.service');
const { getRequestContext } = require('../services/requestContext.service');

/**
 * Extract token dari header Authorization
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} Token atau null jika tidak valid
 */
function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[extractToken] Token tidak ditemukan atau format tidak valid');
    return null;
  }
  console.log('[extractToken] Token berhasil diekstrak');
  return authHeader.split(' ')[1];
}

/**
 * Middleware untuk memvalidasi JWT token
 */
async function authenticateJWT(req, res, next) {
  try {
    console.log(`[authenticateJWT] Memproses request ${req.method} ${req.url}`);
    
    const token = extractToken(req.headers.authorization);
    if (!token) {
      console.log('[authenticateJWT] Request ditolak: Token tidak ada');
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    // Get JWKS
    const jwks = getJwks();
    if (!jwks) {
      console.error('[authenticateJWT] JWKS tidak tersedia');
      return res.status(500).json({
        error: 'Authentication service not available'
      });
    }

    // Find matching key from JWKS
    const key = jwks.keys[0]; // Untuk sementara gunakan key pertama
    console.log('[authenticateJWT] Menggunakan JWKS key dengan kid:', key.kid);
    
    try {
      // Verify token
      const { payload } = await jwtVerify(token, key, {
        issuer: config.auth.jwtIssuer,
        audience: config.auth.jwtAudience
      });

      console.log('[authenticateJWT] Token berhasil diverifikasi untuk user:', payload.sub);
      console.log('[authenticateJWT] Roles user:', payload.roles);

      // Simpan informasi user ke request context
      const context = getRequestContext();
      context.setUserId(payload.sub);
      context.setUserRoles(payload.roles || []);

      console.log('[authenticateJWT] Context berhasil diset dengan user ID:', context.getUserId());
      next();
    } catch (verifyError) {
      console.error('[authenticateJWT] Token verification failed:', verifyError);
      if (verifyError.code === 'ERR_JWT_EXPIRED') {
        console.log('[authenticateJWT] Token telah kadaluarsa. Exp:', verifyError.payload?.exp);
        return res.status(401).json({
          error: 'Token expired',
          expiredAt: new Date(verifyError.payload?.exp * 1000).toISOString()
        });
      }
      return res.status(401).json({
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('[authenticateJWT] Error tidak terduga:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Middleware untuk memeriksa role user
 */
function authorizeRoles(req, res, next) {
  try {
    console.log('[authorizeRoles] Memeriksa roles untuk request:', req.method, req.url);
    
    const context = getRequestContext();
    const userRoles = context.getUserRoles();
    
    console.log('[authorizeRoles] User roles:', userRoles);
    console.log('[authorizeRoles] Allowed roles:', config.auth.allowedRoles);

    // Periksa apakah user memiliki role yang diizinkan
    const allowedRole = userRoles.find(role => 
      config.auth.allowedRoles.includes(role.name)
    );

    if (!allowedRole) {
      console.log('[authorizeRoles] Akses ditolak: Role tidak memiliki izin');
      return res.status(403).json({
        error: 'Insufficient permissions',
        userRoles: userRoles.map(r => r.name),
        requiredRoles: config.auth.allowedRoles
      });
    }

    console.log('[authorizeRoles] Akses diberikan dengan role:', allowedRole.name);
    next();
  } catch (error) {
    console.error('[authorizeRoles] Error saat autorisasi:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  authenticateJWT,
  authorizeRoles
}; 