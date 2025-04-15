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
    // Properti lain dapat ditambahkan sesuai kebutuhan
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
  return true;
}

module.exports = {
  createBranchEntity,
  validateBranchEntity
};
