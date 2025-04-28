const { ObjectId } = require('mongodb');

/**
 * @typedef {Object} BranchAccess
 * @property {ObjectId} _id - ID dari dokumen branch access
 * @property {ObjectId} branch_id - ID dari branch yang diakses
 * @property {string} user_id - UUID dari user yang memiliki akses
 * @property {('R'|'RW')} permission - Tipe akses: R (read) atau RW (read-write)
 */

/**
 * Membuat objek BranchAccess baru
 * @param {Object} data - Data untuk membuat BranchAccess
 * @param {string|ObjectId} data.branch_id - ID dari branch
 * @param {string} data.user_id - UUID dari user
 * @param {string} data.permission - Tipe akses (R/RW)
 * @returns {BranchAccess}
 */
function createBranchAccess(data) {
  return {
    _id: new ObjectId(),
    branch_id: typeof data.branch_id === 'string' ? new ObjectId(data.branch_id) : data.branch_id,
    user_id: data.user_id,
    permission: data.permission
  };
}

/**
 * Memvalidasi data BranchAccess
 * @param {Object} data - Data yang akan divalidasi
 * @throws {Error} Jika validasi gagal
 */
function validateBranchAccess(data) {
  if (!data.branch_id) {
    throw new Error('branch_id is required');
  }
  if (!data.user_id) {
    throw new Error('user_id is required');
  }
  if (!data.permission || !['R', 'RW'].includes(data.permission)) {
    throw new Error('permission must be either R or RW');
  }
}

module.exports = {
  createBranchAccess,
  validateBranchAccess
}; 