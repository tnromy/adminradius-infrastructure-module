/**
 * Service untuk operasi terkait branches
 */

const branchRepository = require('../repositories/branch.repository');
const { DeletedFilterTypes } = require('../utils/recursiveDeletedCheck.util');

/**
 * Mendapatkan semua branches dengan level detail tertentu
 * @param {string} scopeLevel - Level scope data (BRANCHES, ROUTERS, OLTS, ODCS, ODPS, ONTS)
 * @param {string} deleted - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Array>} - Array berisi data branches sesuai level detail
 */
async function getAllBranches(scopeLevel = null, deleted = DeletedFilterTypes.WITHOUT) {
  try {
    // Validasi parameter deleted
    if (!Object.values(DeletedFilterTypes).includes(deleted)) {
      throw new Error(`Invalid deleted filter type. Must be one of: ${Object.values(DeletedFilterTypes).join(', ')}`);
    }

    return await branchRepository.getAllBranches(scopeLevel, deleted);
  } catch (error) {
    console.error('Error in getAllBranches service:', error);
    throw error;
  }
}

/**
 * Mendapatkan branch berdasarkan ID dengan level detail tertentu
 * @param {string} id - ID branch
 * @param {string} scopeLevel - Level scope data (BRANCHES, ROUTERS, OLTS, ODCS, ODPS, ONTS)
 * @param {string} deleted - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data branch sesuai level detail
 */
async function getBranchById(id, scopeLevel = null, deleted = DeletedFilterTypes.WITHOUT) {
  try {
    // Validasi parameter deleted
    if (!Object.values(DeletedFilterTypes).includes(deleted)) {
      throw new Error(`Invalid deleted filter type. Must be one of: ${Object.values(DeletedFilterTypes).join(', ')}`);
    }

    const branch = await branchRepository.getBranchById(id, scopeLevel, deleted);
    if (!branch) {
      throw new Error('Branch not found');
    }
    return branch;
  } catch (error) {
    console.error('Error in getBranchById service:', error);
    throw error;
  }
}

// ... existing code ...
