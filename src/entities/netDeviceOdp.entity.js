/**
 * Entity untuk netDeviceOdp (perangkat Optical Distribution Point)
 */

const { createNetDeviceEntity, validateNetDeviceEntity } = require('./netDevice.entity');

/**
 * Fungsi untuk memeriksa tipe anak yang valid untuk ODP
 * @param {Object} child - Objek anak yang akan diperiksa
 * @returns {boolean} - True jika valid
 */
function isValidChild(child) {
  // Hanya menerima netDeviceOnt
  return child && child.type && child.type === 'ont';
}

/**
 * Fungsi untuk membuat objek netDeviceOdp
 * @param {Object} data - Data ODP
 * @returns {Object} - Objek netDeviceOdp
 */
function createNetDeviceOdpEntity(data = {}) {
  // Buat base netDevice entity
  const baseEntity = createNetDeviceEntity({
    ...data,
    type: 'odp'
  });
  
  // Tambahkan properti khusus ODP
  return {
    ...baseEntity,
    core_on_odc_tray: data.core_on_odc_tray || 1,
    available_port: data.available_port || 0,
    children: data.children || []
  };
}

/**
 * Fungsi untuk memvalidasi data netDeviceOdp
 * @param {Object} data - Data ODP
 * @returns {boolean} - True jika valid
 */
function validateNetDeviceOdpEntity(data) {
  // Validasi base properties
  if (!validateNetDeviceEntity({...data, type: 'odp'})) {
    return false;
  }
  
  // Validasi core_on_odc_tray (harus integer dan dimulai dari 1)
  if (typeof data.core_on_odc_tray !== 'number' || !Number.isInteger(data.core_on_odc_tray) || data.core_on_odc_tray < 1) {
    return false;
  }
  
  // Validasi available_port (harus integer lebih besar dari 0)
  if (typeof data.available_port !== 'number' || !Number.isInteger(data.available_port) || data.available_port < 0) {
    return false;
  }
  
  // Validasi children
  if (data.children) {
    if (!Array.isArray(data.children)) {
      return false;
    }
    
    // Validasi setiap anak, pastikan tipenya adalah ONT
    for (const child of data.children) {
      if (!isValidChild(child)) {
        return false;
      }
    }
  }
  
  return true;
}

module.exports = {
  createNetDeviceOdpEntity,
  validateNetDeviceOdpEntity
};
