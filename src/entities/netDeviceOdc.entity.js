/**
 * Entity untuk netDeviceOdc (perangkat Optical Distribution Cabinet)
 */

const { createNetDeviceEntity, validateNetDeviceEntity } = require('./netDevice.entity');

/**
 * Fungsi untuk memeriksa tipe anak yang valid untuk ODC Tray
 * @param {Object} child - Objek anak yang akan diperiksa
 * @returns {boolean} - True jika valid
 */
function isValidTrayChild(child) {
  // Hanya menerima netDeviceOdp
  return child && child.type && child.type === 'odp';
}

/**
 * Fungsi untuk membuat objek Tray ODC
 * @param {Object} data - Data tray
 * @returns {Object} - Objek tray
 */
function createOdcTrayEntity(data = {}) {
  return {
    tray: data.tray || 1,
    start_core: data.start_core || 1,
    end_core: data.end_core || 1,
    children: data.children || []
  };
}

/**
 * Fungsi untuk memvalidasi data tray ODC
 * @param {Object} data - Data tray
 * @param {Array} existingTrays - Array tray yang sudah ada (untuk validasi keunikan)
 * @returns {boolean} - True jika valid
 */
function validateOdcTrayEntity(data, existingTrays = []) {
  // Validasi tray number (harus integer dan dimulai dari 1)
  if (typeof data.tray !== 'number' || !Number.isInteger(data.tray) || data.tray < 1) {
    return false;
  }
  
  // Validasi keunikan tray number
  if (existingTrays.some(t => t.tray === data.tray)) {
    return false;
  }
  
  // Validasi start_core (harus integer)
  if (typeof data.start_core !== 'number' || !Number.isInteger(data.start_core) || data.start_core < 1) {
    return false;
  }
  
  // Validasi end_core (harus integer dan >= start_core)
  if (typeof data.end_core !== 'number' || !Number.isInteger(data.end_core) || data.end_core < data.start_core) {
    return false;
  }
  
  // Validasi children
  if (!Array.isArray(data.children)) {
    return false;
  }
  
  // Validasi setiap anak, pastikan tipenya adalah ODP
  for (const child of data.children) {
    if (!isValidTrayChild(child)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Fungsi untuk membuat objek netDeviceOdc
 * @param {Object} data - Data ODC
 * @returns {Object} - Objek netDeviceOdc
 */
function createNetDeviceOdcEntity(data = {}) {
  // Buat base netDevice entity
  const baseEntity = createNetDeviceEntity({
    ...data,
    type: 'odc'
  });
  
  // Buat array trays jika ada
  const trays = [];
  if (Array.isArray(data.trays)) {
    data.trays.forEach(trayData => {
      trays.push(createOdcTrayEntity(trayData));
    });
  }
  
  // Tambahkan properti khusus ODC
  return {
    ...baseEntity,
    available_tray: data.available_tray || 0,
    trays: trays
  };
}

/**
 * Fungsi untuk memvalidasi data netDeviceOdc
 * @param {Object} data - Data ODC
 * @returns {boolean} - True jika valid
 */
function validateNetDeviceOdcEntity(data) {
  // Validasi base properties
  if (!validateNetDeviceEntity({...data, type: 'odc'})) {
    return false;
  }
  
  // Validasi available_tray
  if (typeof data.available_tray !== 'number' || !Number.isInteger(data.available_tray) || data.available_tray < 0) {
    return false;
  }
  
  // Validasi trays
  if (data.trays) {
    if (!Array.isArray(data.trays)) {
      return false;
    }
    
    const existingTrays = [];
    for (const tray of data.trays) {
      if (!validateOdcTrayEntity(tray, existingTrays)) {
        return false;
      }
      existingTrays.push(tray);
    }
  }
  
  return true;
}

module.exports = {
  createNetDeviceOdcEntity,
  validateNetDeviceOdcEntity,
  createOdcTrayEntity,
  validateOdcTrayEntity
};
