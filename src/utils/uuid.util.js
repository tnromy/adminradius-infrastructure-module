/**
 * UUID Helper
 * 
 * Modul ini menyediakan fungsi-fungsi helper untuk generate UUID
 * Secara default menggunakan UUID v7 yang memberikan keuntungan:
 * - Memiliki timestamp yang terintegrasi (time ordered)
 * - Memudahkan sorting berdasarkan waktu pembuatan
 * - Kompatibel dengan format UUID standar
 */

const { v7: uuidv7, v4: uuidv4 } = require('uuid');

/**
 * Generate UUID v7 (default)
 * UUID v7 menggabungkan timestamp dengan random bits
 * Sangat cocok untuk primary key yang perlu diurutkan berdasarkan waktu
 * 
 * @returns {string} UUID v7 string
 */
const generateUUID = () => {
  try {
    return uuidv7();
  } catch (error) {
    console.error(`Error generating UUID v7: ${error.message}`);
    // Fallback ke UUID v4 jika v7 tidak tersedia
    return uuidv4();
  }
};

/**
 * Generate UUID v4 (completely random)
 * 
 * @returns {string} UUID v4 string
 */
const generateRandomUUID = () => {
  return uuidv4();
};

/**
 * Memeriksa apakah string adalah UUID valid
 * 
 * @param {string} uuid - String yang akan diperiksa
 * @returns {boolean} true jika valid, false jika tidak
 */
const isValidUUID = (uuid) => {
  if (!uuid) return false;
  
  // Format regex untuk UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

module.exports = {
  generateUUID,
  generateRandomUUID,
  isValidUUID
}; 