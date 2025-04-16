/**
 * Entity untuk netDeviceOlt (perangkat Optical Line Terminal)
 */

const { createNetDeviceEntity, validateNetDeviceEntity } = require('./netDevice.entity');
const { 
  createTelnetConnEntity, validateTelnetConnEntity,
  createSshConnEntity, validateSshConnEntity,
  createSnmpConnEntity, validateSnmpConnEntity
} = require('./netDeviceConn.entity');

/**
 * Enum untuk tipe PON
 * @enum {string}
 */
const PonTypes = {
  GPON: 'GPON',
  EPON: 'EPON'
};

/**
 * Fungsi untuk memeriksa tipe anak yang valid untuk port PON
 * @param {Object} child - Objek anak yang akan diperiksa
 * @returns {boolean} - True jika valid
 */
function isValidPortChild(child) {
  // Hanya menerima netDeviceOdc
  return child && child.type && child.type === 'odc';
}

/**
 * Fungsi untuk membuat objek PON port
 * @param {Object} data - Data port PON
 * @returns {Object} - Objek port PON
 */
function createPonPortEntity(data = {}) {
  return {
    port: data.port || 1,
    max_client: data.max_client || 1,
    children: data.children || []
  };
}

/**
 * Fungsi untuk memvalidasi data PON port
 * @param {Object} data - Data port PON
 * @param {Array} existingPorts - Array port yang sudah ada (untuk validasi keunikan)
 * @returns {boolean} - True jika valid
 */
function validatePonPortEntity(data, existingPorts = []) {
  // Validasi port number (harus integer dan dimulai dari 1)
  if (typeof data.port !== 'number' || !Number.isInteger(data.port) || data.port < 1) {
    return false;
  }
  
  // Validasi keunikan port number
  if (existingPorts.some(p => p.port === data.port)) {
    return false;
  }
  
  // Validasi max_client (harus integer lebih besar dari 0)
  if (typeof data.max_client !== 'number' || !Number.isInteger(data.max_client) || data.max_client < 1) {
    return false;
  }
  
  // Validasi children
  if (!Array.isArray(data.children)) {
    return false;
  }
  
  // Validasi setiap anak, pastikan tipenya adalah ODC
  for (const child of data.children) {
    if (!isValidPortChild(child)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Fungsi untuk membuat objek netDeviceOlt
 * @param {Object} data - Data OLT
 * @returns {Object} - Objek netDeviceOlt
 */
function createNetDeviceOltEntity(data = {}) {
  // Buat base netDevice entity
  const baseEntity = createNetDeviceEntity({
    ...data,
    type: 'olt'
  });
  
  // Buat array pon_port jika ada
  const ponPorts = [];
  if (Array.isArray(data.pon_port)) {
    data.pon_port.forEach(portData => {
      ponPorts.push(createPonPortEntity(portData));
    });
  }
  
  // Tambahkan properti khusus OLT
  return {
    ...baseEntity,
    vendor: data.vendor || '',
    model: data.model || '',
    sn: data.sn || '',
    telnet_conn: data.telnet_conn ? createTelnetConnEntity(data.telnet_conn) : null,
    ssh_conn: data.ssh_conn ? createSshConnEntity(data.ssh_conn) : null,
    snmp_conn: data.snmp_conn ? createSnmpConnEntity(data.snmp_conn) : null,
    pon_type: data.pon_type || PonTypes.GPON,
    pon_port: ponPorts
  };
}

/**
 * Fungsi untuk memvalidasi data netDeviceOlt
 * @param {Object} data - Data OLT
 * @returns {boolean} - True jika valid
 */
function validateNetDeviceOltEntity(data) {
  // Validasi base properties
  if (!validateNetDeviceEntity({...data, type: 'olt'})) {
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
  
  // Validasi koneksi telnet
  if (data.telnet_conn && !validateTelnetConnEntity(data.telnet_conn)) {
    return false;
  }
  
  // Validasi koneksi SSH
  if (data.ssh_conn && !validateSshConnEntity(data.ssh_conn)) {
    return false;
  }
  
  // Validasi koneksi SNMP
  if (data.snmp_conn && !validateSnmpConnEntity(data.snmp_conn)) {
    return false;
  }
  
  // Validasi pon_type
  if (data.pon_type && !Object.values(PonTypes).includes(data.pon_type)) {
    return false;
  }
  
  // Validasi pon_port
  if (data.pon_port) {
    if (!Array.isArray(data.pon_port)) {
      return false;
    }
    
    const existingPorts = [];
    for (const port of data.pon_port) {
      if (!validatePonPortEntity(port, existingPorts)) {
        return false;
      }
      existingPorts.push(port);
    }
  }
  
  return true;
}

module.exports = {
  createNetDeviceOltEntity,
  validateNetDeviceOltEntity,
  PonTypes,
  createPonPortEntity,
  validatePonPortEntity
};
