/**
 * Entity untuk netDevice (perangkat jaringan)
 */

const { createLocationEntity, validateLocationEntity } = require('./location.entity');
const { createAddressEntity, validateAddressEntity } = require('./address.entity');

/**
 * Fungsi untuk membuat objek netDevice
 * @param {Object} data - Data perangkat jaringan
 * @returns {Object} - Objek netDevice
 */
function createNetDeviceEntity(data = {}) {
  return {
    _id: data._id || null,
    label: data.label || '',
    type: data.type || '',
    location: data.location ? createLocationEntity(data.location) : createLocationEntity(),
    address: data.address ? createAddressEntity(data.address) : createAddressEntity(),
    children: data.children || [],
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date()
  };
}

/**
 * Fungsi untuk memvalidasi data netDevice
 * @param {Object} data - Data netDevice
 * @returns {boolean} - True jika valid
 */
function validateNetDeviceEntity(data) {
  if (!data.label || typeof data.label !== 'string') {
    return false;
  }
  
  if (!data.type || typeof data.type !== 'string') {
    return false;
  }
  
  // Validasi location jika ada
  if (data.location && !validateLocationEntity(data.location)) {
    return false;
  }
  
  // Validasi address jika ada
  if (data.address && !validateAddressEntity(data.address)) {
    return false;
  }
  
  // Validasi children jika ada
  if (data.children && !Array.isArray(data.children)) {
    return false;
  }
  
  return true;
}

module.exports = {
  createNetDeviceEntity,
  validateNetDeviceEntity
};
