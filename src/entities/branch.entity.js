/**
 * Entity untuk branch (cabang)
 */

const { createLocationEntity, validateLocationEntity } = require('./location.entity');
const { createAddressEntity, validateAddressEntity } = require('./address.entity');
const { createContactEntity, validateContactEntity } = require('./contact.entity');
const { validateNetDeviceRouterEntity } = require('./netDeviceRouter.entity');

/**
 * Fungsi untuk membuat objek branch
 * @param {Object} data - Data branch
 * @returns {Object} - Objek branch
 */
function createBranchEntity(data = {}) {
  return {
    _id: data._id || null,
    name: data.name || '',
    location: data.location ? createLocationEntity(data.location) : createLocationEntity(),
    address: data.address ? createAddressEntity(data.address) : createAddressEntity(),
    contact: data.contact ? createContactEntity(data.contact) : createContactEntity(),
    children: data.children || [],
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date()
  };
}

/**
 * Fungsi untuk memvalidasi data branch
 * @param {Object} data - Data branch
 * @returns {boolean} - True jika valid
 */
function validateBranchEntity(data) {
  if (!data.name || typeof data.name !== 'string') {
    return false;
  }
  
  if (data.name.length < 3 || data.name.length > 64) {
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
  
  // Validasi contact jika ada
  if (data.contact && !validateContactEntity(data.contact)) {
    return false;
  }
  
  // Validasi children jika ada
  if (data.children) {
    if (!Array.isArray(data.children)) {
      return false;
    }
    
    // Validasi setiap item dalam children harus berupa netDeviceRouter
    for (const child of data.children) {
      if (!validateNetDeviceRouterEntity(child)) {
        return false;
      }
    }
  }
  
  return true;
}

module.exports = {
  createBranchEntity,
  validateBranchEntity
};
