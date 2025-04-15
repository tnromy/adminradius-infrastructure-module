/**
 * Entity untuk address (alamat)
 */

/**
 * Fungsi untuk membuat objek address
 * @param {Object} data - Data alamat
 * @returns {Object} - Objek address
 */
function createAddressEntity(data = {}) {
  return {
    country: data.country || 'ID', // Default Indonesia
    province: data.province || '',
    city: data.city || '',
    district: data.district || '',
    village: data.village || '',
    detail: data.detail || '',
    zip_code: data.zip_code || ''
  };
}

/**
 * Fungsi untuk memvalidasi data address
 * @param {Object} data - Data address
 * @returns {boolean} - True jika valid
 */
function validateAddressEntity(data) {
  if (!data) {
    return false;
  }
  
  // Validasi country (harus ada dan string)
  if (!data.country || typeof data.country !== 'string') {
    return false;
  }
  
  // Validasi tipe data
  const stringFields = ['province', 'city', 'district', 'village', 'detail', 'zip_code'];
  for (const field of stringFields) {
    if (data[field] && typeof data[field] !== 'string') {
      return false;
    }
  }
  
  return true;
}

module.exports = {
  createAddressEntity,
  validateAddressEntity
}; 