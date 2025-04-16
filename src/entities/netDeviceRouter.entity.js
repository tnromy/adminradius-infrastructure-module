/**
 * Entity untuk netDeviceRouter (perangkat router)
 */

const { createNetDeviceEntity, validateNetDeviceEntity } = require('./netDevice.entity');

/**
 * Enum untuk tipe koneksi router
 * @enum {string}
 */
const ConnectionTypes = {
  OPENVPN: 'OPENVPN',
  PUBLIC: 'PUBLIC',
  ZEROTIER: 'ZEROTIER'
};

/**
 * Fungsi untuk validasi alamat IP v4
 * @param {string} ip - Alamat IP yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
function isValidIPv4(ip) {
  if (typeof ip !== 'string') return false;
  
  // Pola IPv4: xxx.xxx.xxx.xxx
  const pattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return pattern.test(ip);
}

/**
 * Fungsi untuk memeriksa tipe anak yang valid
 * @param {Object} child - Objek anak yang akan diperiksa
 * @returns {boolean} - True jika valid
 */
function isValidChild(child) {
  // Hanya menerima netDeviceOlt
  const validTypes = ['olt'];
  return child && child.type && validTypes.includes(child.type);
}

/**
 * Fungsi untuk membuat objek netDeviceRouter
 * @param {Object} data - Data router
 * @returns {Object} - Objek netDeviceRouter
 */
function createNetDeviceRouterEntity(data = {}) {
  // Buat base netDevice entity
  const baseEntity = createNetDeviceEntity({
    ...data,
    type: 'router'
  });
  
  // Tambahkan properti khusus router
  return {
    ...baseEntity,
    connection_type: data.connection_type || ConnectionTypes.PUBLIC,
    ip_addr: data.ip_addr || '',
    // Children hanya bisa berisi OLT
    children: data.children || []
  };
}

/**
 * Fungsi untuk memvalidasi data netDeviceRouter
 * @param {Object} data - Data router
 * @returns {boolean} - True jika valid
 */
function validateNetDeviceRouterEntity(data) {
  // Validasi base properties
  if (!validateNetDeviceEntity({...data, type: 'router'})) {
    return false;
  }
  
  // Validasi connection_type
  if (data.connection_type && !Object.values(ConnectionTypes).includes(data.connection_type)) {
    return false;
  }
  
  // Validasi ip_addr
  if (data.ip_addr && !isValidIPv4(data.ip_addr)) {
    return false;
  }
  
  // Validasi children
  if (data.children) {
    if (!Array.isArray(data.children)) {
      return false;
    }
    
    // Validasi setiap anak, pastikan tipenya valid
    for (const child of data.children) {
      if (!isValidChild(child)) {
        return false;
      }
    }
  }
  
  return true;
}

module.exports = {
  createNetDeviceRouterEntity,
  validateNetDeviceRouterEntity,
  ConnectionTypes,
  isValidChild
};
