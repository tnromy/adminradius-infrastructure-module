/**
 * Service untuk mengelola JWKS (JSON Web Key Set)
 */

const axios = require('axios');
const config = require('../../config/app.config');

// Variable global untuk menyimpan JWKS
let globalJwks = null;

/**
 * Mengambil JWKS dari URL yang ditentukan
 * @returns {Promise<Object>} JWKS yang sudah diformat
 */
async function fetchJwks() {
  try {
    console.log('[fetchJwks] Mengambil JWKS dari:', config.auth.jwksUrl);
    
    const response = await axios.get(config.auth.jwksUrl);
    const jwks = response.data;
    
    // Format JWKS untuk penggunaan nantinya
    const formattedJwks = {
      keys: jwks.keys.map(key => ({
        kid: key.kid,
        kty: key.kty,
        alg: key.alg,
        use: key.use,
        n: key.n,
        e: key.e
      }))
    };
    
    console.log('[fetchJwks] JWKS berhasil diambil dan diformat');
    return formattedJwks;
  } catch (error) {
    console.error('[fetchJwks] Error saat mengambil JWKS:', error);
    throw error;
  }
}

/**
 * Menginisialisasi JWKS
 * @returns {Promise<void>}
 */
async function initializeJwks() {
  try {
    console.log('[initializeJwks] Memulai inisialisasi JWKS');
    globalJwks = await fetchJwks();
    console.log('[initializeJwks] JWKS berhasil diinisialisasi');
  } catch (error) {
    console.error('[initializeJwks] Error saat inisialisasi JWKS:', error);
    throw error;
  }
}

/**
 * Mendapatkan JWKS yang sudah diformat
 * @returns {Object} JWKS yang sudah diformat
 */
function getJwks() {
  return globalJwks;
}

module.exports = {
  initializeJwks,
  getJwks
}; 