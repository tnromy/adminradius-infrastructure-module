/**
 * Entity untuk branch (cabang)
 */

/**
 * Fungsi untuk membuat objek branch
 * @param {Object} data - Data branch
 * @returns {Object} - Objek branch
 */
function createBranchEntity(data = {}) {
  return {
    _id: data._id || null,
    name: data.name || '',
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
  
  return true;
}

module.exports = {
  createBranchEntity,
  validateBranchEntity
};
