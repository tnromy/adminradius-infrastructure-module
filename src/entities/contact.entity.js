/**
 * Entity untuk contact (kontak)
 */

/**
 * Fungsi untuk membuat objek contact
 * @param {Object} data - Data kontak
 * @returns {Object} - Objek contact
 */
function createContactEntity(data = {}) {
  return {
    email: data.email || '',
    phone: data.phone || ''
  };
}

/**
 * Fungsi untuk memvalidasi data contact
 * @param {Object} data - Data contact
 * @returns {boolean} - True jika valid
 */
function validateContactEntity(data) {
  if (!data) {
    return false;
  }
  
  // Validasi email jika ada
  if (data.email) {
    if (typeof data.email !== 'string') {
      return false;
    }
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return false;
    }
  }
  
  // Validasi phone jika ada
  if (data.phone) {
    if (typeof data.phone !== 'string') {
      return false;
    }
    
    // Simple phone validation (at least 8 digits)
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    if (!phoneRegex.test(data.phone)) {
      return false;
    }
  }
  
  return true;
}

module.exports = {
  createContactEntity,
  validateContactEntity
}; 