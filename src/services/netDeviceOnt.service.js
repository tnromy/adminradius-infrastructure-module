/**
 * Service untuk operasi terkait ONT
 */

const netDeviceOntRepository = require('../repositories/netDeviceOnt.repository');
const { DeletedFilterTypes } = require('../utils/recursiveDeletedCheck.util');

/**
 * Mendapatkan ONT berdasarkan ID
 * @param {string} ontId - ID ONT
 * @param {string} deleted - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} Data ONT
 */
async function getOntById(ontId, deleted = DeletedFilterTypes.WITHOUT) {
  try {
    // Validasi parameter deleted
    if (!Object.values(DeletedFilterTypes).includes(deleted)) {
      throw new Error(`Invalid deleted filter type. Must be one of: ${Object.values(DeletedFilterTypes).join(', ')}`);
    }

    const ont = await netDeviceOntRepository.getOntById(ontId, deleted);
    if (!ont) {
      throw new Error('ONT not found');
    }
    return ont;
  } catch (error) {
    console.error('Error in getOntById service:', error);
    throw error;
  }
}

/**
 * Melakukan restore pada ONT yang sudah di-soft delete
 * @param {string} ontId - ID ONT yang akan di-restore
 * @returns {Promise<Object>} ONT yang sudah di-restore
 */
async function restoreOnt(ontId) {
  try {
    const ont = await netDeviceOntRepository.restoreOnt(ontId);
    if (!ont) {
      throw new Error('ONT not found or already restored');
    }
    return ont;
  } catch (error) {
    console.error('Error in restoreOnt service:', error);
    throw error;
  }
}

module.exports = {
  getOntById,
  restoreOnt
}; 