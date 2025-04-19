/**
 * Service untuk operasi terkait ONT
 */

const netDeviceOntRepository = require('../repositories/netDeviceOnt.repository');
const { DeletedFilterTypes } = require('../utils/recursiveDeletedCheck.util');
const { logDebug, logError } = require('./logger.service');
const { getRequestContext } = require('./requestContext.service');

/**
 * Mendapatkan ONT berdasarkan ID
 * @param {string} ontId - ID ONT
 * @param {string} deleted - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} Data ONT
 */
async function getOntById(ontId, deleted = DeletedFilterTypes.WITHOUT) {
  try {
    const context = getRequestContext();
    
    // Validasi parameter deleted
    if (!Object.values(DeletedFilterTypes).includes(deleted)) {
      logError('Invalid deleted filter type pada getOntById', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        ontId: ontId,
        deletedFilterType: deleted,
        validTypes: Object.values(DeletedFilterTypes)
      });
      
      throw new Error(`Invalid deleted filter type. Must be one of: ${Object.values(DeletedFilterTypes).join(', ')}`);
    }
    
    logDebug('Mengambil data ONT dari repository', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ontId,
      deletedFilter: deleted
    });

    const ont = await netDeviceOntRepository.getOntById(ontId, deleted);
    if (!ont) {
      logDebug('ONT tidak ditemukan', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        ontId: ontId,
        deletedFilter: deleted
      });
      
      throw new Error('ONT not found');
    }
    return ont;
  } catch (error) {
    logError('Error pada getOntById service', {
      requestId: getRequestContext().getRequestId(),
      userId: getRequestContext().getUserId(),
      error: error.message,
      stack: error.stack,
      ontId: ontId
    });
    
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
    const context = getRequestContext();
    
    logDebug('Melakukan restore ONT dari repository', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ontId
    });
    
    const ont = await netDeviceOntRepository.restoreOnt(ontId);
    if (!ont) {
      logDebug('ONT tidak ditemukan atau sudah di-restore', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        ontId: ontId
      });
      
      throw new Error('ONT not found or already restored');
    }
    return ont;
  } catch (error) {
    logError('Error pada restoreOnt service', {
      requestId: getRequestContext().getRequestId(),
      userId: getRequestContext().getUserId(),
      error: error.message,
      stack: error.stack,
      ontId: ontId
    });
    
    throw error;
  }
}

module.exports = {
  getOntById,
  restoreOnt
}; 