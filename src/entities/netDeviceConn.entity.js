/**
 * Entity untuk berbagai jenis koneksi perangkat jaringan
 * File ini berisi definisi entity untuk koneksi telnet, ssh, dan snmp
 */

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
 * Fungsi untuk validasi port yang valid
 * @param {number} port - Nomor port yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
function isValidPort(port) {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Fungsi untuk membuat objek koneksi telnet
 * @param {Object} data - Data koneksi telnet
 * @returns {Object} - Objek koneksi telnet
 */
function createTelnetConnEntity(data = {}) {
  return {
    ip_addr: data.ip_addr || '',
    port: data.port || 23, // Default telnet port
    username: data.username || '',
    password: data.password || ''
  };
}

/**
 * Fungsi untuk validasi koneksi telnet
 * @param {Object} data - Data koneksi telnet
 * @returns {boolean} - True jika valid
 */
function validateTelnetConnEntity(data) {
  if (!isValidIPv4(data.ip_addr)) {
    return false;
  }

  if (!isValidPort(data.port)) {
    return false;
  }

  if (typeof data.username !== 'string') {
    return false;
  }

  if (typeof data.password !== 'string') {
    return false;
  }

  return true;
}

/**
 * Fungsi untuk membuat objek koneksi SSH
 * @param {Object} data - Data koneksi SSH
 * @returns {Object} - Objek koneksi SSH
 */
function createSshConnEntity(data = {}) {
  return {
    ip_addr: data.ip_addr || '',
    port: data.port || 22, // Default SSH port
    username: data.username || '',
    password: data.password || ''
  };
}

/**
 * Fungsi untuk validasi koneksi SSH
 * @param {Object} data - Data koneksi SSH
 * @returns {boolean} - True jika valid
 */
function validateSshConnEntity(data) {
  if (!isValidIPv4(data.ip_addr)) {
    return false;
  }

  if (!isValidPort(data.port)) {
    return false;
  }

  if (typeof data.username !== 'string') {
    return false;
  }

  if (typeof data.password !== 'string') {
    return false;
  }

  return true;
}

/**
 * Fungsi untuk membuat objek koneksi SNMP
 * @param {Object} data - Data koneksi SNMP
 * @returns {Object} - Objek koneksi SNMP
 */
function createSnmpConnEntity(data = {}) {
  return {
    ip_addr: data.ip_addr || '',
    port: data.port || 161, // Default SNMP port
    community_read: data.community_read || 'public',
    community_write: data.community_write || 'private'
  };
}

/**
 * Fungsi untuk validasi koneksi SNMP
 * @param {Object} data - Data koneksi SNMP
 * @returns {boolean} - True jika valid
 */
function validateSnmpConnEntity(data) {
  if (!isValidIPv4(data.ip_addr)) {
    return false;
  }

  if (!isValidPort(data.port)) {
    return false;
  }

  if (typeof data.community_read !== 'string') {
    return false;
  }

  if (typeof data.community_write !== 'string') {
    return false;
  }

  return true;
}

module.exports = {
  createTelnetConnEntity,
  validateTelnetConnEntity,
  createSshConnEntity,
  validateSshConnEntity,
  createSnmpConnEntity,
  validateSnmpConnEntity,
  isValidIPv4,
  isValidPort
}; 