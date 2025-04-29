const { ObjectId } = require('mongodb');

/**
 * Enum untuk permission branch access
 * @enum {string}
 */
const BranchAccessPermission = {
  READ: 'R',
  READ_WRITE: 'RW'
};

/**
 * Enum untuk status branch access
 * @enum {string}
 */
const BranchAccessStatus = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED'
};

/**
 * @typedef {Object} BranchAccess
 * @property {ObjectId} _id - ID dari dokumen branch access
 * @property {ObjectId} branch_id - ID dari branch yang diakses
 * @property {string} user_id - UUID dari user yang memiliki akses
 * @property {('R'|'RW')} permission - Tipe akses: R (read) atau RW (read-write)
 */

/**
 * Membuat basic branch access entity (minimal)
 * @param {Object} data - Data untuk membuat basic branch access
 * @returns {Object} Basic branch access entity
 */
function createBasicBranchAccessEntity(data = {}) {
  return {
    _id: data._id || null,
    branch_id: typeof data.branch_id === 'string' ? new ObjectId(data.branch_id) : data.branch_id,
    user_id: data.user_id,
    permission: data.permission
  };
}

/**
 * Membuat full branch access entity
 * @param {Object} data - Data untuk membuat branch access
 * @returns {Object} Full branch access entity
 */
function createBranchAccessEntity(data = {}) {
  const now = new Date();
  
  return {
    _id: data._id || null,
    branch_id: typeof data.branch_id === 'string' ? new ObjectId(data.branch_id) : data.branch_id,
    user_id: data.user_id,
    permission: data.permission,
    name: data.name || '',
    email: data.email || '',
    phone: data.phone || '',
    ava_path: data.ava_path || '',
    status: data.status || BranchAccessStatus.SUBMITTED,
    user_note: data.user_note || null,
    reviewer_note: data.reviewer_note || null,
    approved_by_user_id: data.approved_by_user_id || null,
    rejected_by_user_id: data.rejected_by_user_id || null,
    revoked_by_user_id: data.revoked_by_user_id || null,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now
  };
}

/**
 * Membuat list branch access entity
 * @param {Array} dataList - Array of branch access data
 * @returns {Array} Array of branch access entities
 */
function createBranchAccessListEntity(dataList = []) {
  return dataList.map(data => createBranchAccessEntity(data));
}

/**
 * Validasi branch access entity
 * @param {Object} data - Data yang akan divalidasi
 * @returns {boolean} True jika valid
 */
function validateBranchAccessEntity(data) {
  if (!data.branch_id || !ObjectId.isValid(data.branch_id)) {
    return false;
  }

  if (!data.user_id) {
    return false;
  }

  if (data.permission && !Object.values(BranchAccessPermission).includes(data.permission)) {
    return false;
  }

  if (data.status && !Object.values(BranchAccessStatus).includes(data.status)) {
    return false;
  }

  return true;
}

module.exports = {
  BranchAccessPermission,
  BranchAccessStatus,
  createBasicBranchAccessEntity,
  createBranchAccessEntity,
  createBranchAccessListEntity,
  validateBranchAccessEntity
}; 