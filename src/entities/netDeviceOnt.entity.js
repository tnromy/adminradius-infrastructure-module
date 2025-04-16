/**
 * Entity untuk netDeviceOnt (perangkat Optical Network Terminal)
 */

const { createNetDeviceEntity, validateNetDeviceEntity } = require('./netDevice.entity');

/**
 * Fungsi untuk membuat objek netDeviceOnt
 * @param {Object} data - Data ONT
 * @returns {Object} - Objek netDeviceOnt
 */
function createNetDeviceOntEntity(data = {}) {
  // Buat base netDevice entity
  const baseEntity = createNetDeviceEntity({
    ...data,
    type: 'ont'
  });
  
  // Tambahkan properti khusus ONT
  return {
    ...baseEntity,
    vendor: data.vendor || '',
    model: data.model || '',
    sn: data.sn || ''
  };
}

/**
 * Fungsi untuk memvalidasi data netDeviceOnt
 * @param {Object} data - Data ONT
 * @returns {boolean} - True jika valid
 */
function validateNetDeviceOntEntity(data) {
  // Validasi base properties
  if (!validateNetDeviceEntity({...data, type: 'ont'})) {
    return false;
  }
  
  // Validasi properti vendor
  if (typeof data.vendor !== 'string') {
    return false;
  }
  
  // Validasi properti model
  if (typeof data.model !== 'string') {
    return false;
  }
  
  // Validasi properti serial number
  if (typeof data.sn !== 'string') {
    return false;
  }
  
  return true;
}

module.exports = {
  createNetDeviceOntEntity,
  validateNetDeviceOntEntity
};
