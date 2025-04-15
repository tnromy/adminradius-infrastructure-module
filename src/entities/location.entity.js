/**
 * Entity untuk location (lokasi) menggunakan format GeoJSON Point
 */

/**
 * Fungsi untuk membuat objek location
 * @param {Object} data - Data lokasi
 * @returns {Object} - Objek location dalam format GeoJSON Point
 */
function createLocationEntity(data = {}) {
  return {
    type: data.type || "Point",
    coordinates: data.coordinates || [0, 0] // [longitude, latitude]
  };
}

/**
 * Fungsi untuk memvalidasi data location
 * @param {Object} data - Data location
 * @returns {boolean} - True jika valid
 */
function validateLocationEntity(data) {
  if (!data || !data.type || !data.coordinates) {
    return false;
  }
  
  if (data.type !== "Point") {
    return false;
  }
  
  if (!Array.isArray(data.coordinates) || data.coordinates.length !== 2) {
    return false;
  }
  
  // Validasi longitude (-180 sampai 180)
  if (typeof data.coordinates[0] !== 'number' || 
      data.coordinates[0] < -180 || 
      data.coordinates[0] > 180) {
    return false;
  }
  
  // Validasi latitude (-90 sampai 90)
  if (typeof data.coordinates[1] !== 'number' || 
      data.coordinates[1] < -90 || 
      data.coordinates[1] > 90) {
    return false;
  }
  
  return true;
}

module.exports = {
  createLocationEntity,
  validateLocationEntity
}; 