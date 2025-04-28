const { ObjectId } = require('mongodb');
const branchAccessRepository = require('../repositories/branchAccess.repository');
const { getRequestContext } = require('../services/requestContext.service');
const { logDebug, logError, createErrorResponse, logWarn } = require('../services/logger.service');
const { getCollection } = require('../repositories/database.connector');

/**
 * Helper function untuk validasi dan konversi ObjectId
 * @param {string} id - ID yang akan divalidasi
 * @returns {ObjectId|null} - ObjectId jika valid, null jika tidak
 */
function validateAndConvertId(id) {
  try {
    if (!id) return null;
    // Coba konversi ke ObjectId
    return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware untuk memastikan hanya role Client Owner yang bisa akses
 */
function requireClientOwner(req, res, next) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();

  const isClientOwner = userRoles.some(role => role.name === 'Client Owner');
  
  if (!isClientOwner) {
    logError('Access denied - Only Client Owner allowed', {
      userId: context.getUserId(),
      roles: userRoles.map(r => r.name)
    });
    
    return res.status(403).json(createErrorResponse(
      403,
      'Forbidden - Only Client Owner can access this endpoint'
    ));
  }

  next();
}

/**
 * Middleware untuk memeriksa permission branch access berdasarkan list branch
 * Type A: Untuk endpoint yang memerlukan filtering berdasarkan accessible branches
 */
async function checkBranchListAccess(req, res, next) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();
  const userId = context.getUserId();

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    const accessibleBranches = await branchAccessRepository.getAccessibleBranches(userId);
    
    // Simpan list branch yang bisa diakses ke request context
    req.accessibleBranchIds = accessibleBranches.map(access => access.branch_id);
    
    logDebug('Branch list access checked', {
      userId,
      accessibleBranchCount: req.accessibleBranchIds.length
    });

    next();
  } catch (error) {
    logError('Error checking branch list access', {
      userId,
      error: error.message
    });
    return res.status(500).json(createErrorResponse(
      500,
      'Internal server error while checking access'
    ));
  }
}

/**
 * Middleware untuk memeriksa permission branch access berdasarkan branch_id
 * Type B: Untuk endpoint dengan branch_id di URL
 */
async function checkDirectBranchAccess(req, res, next) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();
  const userId = context.getUserId();
  const branchId = req.params.id || req.params.branch_id; // Support both :id and :branch_id params

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    // Validasi branch_id menggunakan helper function
    const branchObjectId = validateAndConvertId(branchId);
    if (!branchObjectId) {
      logWarn('Invalid branch_id format', {
        userId,
        branchId,
        requestId: context.getRequestId()
      });
      return res.status(400).json(createErrorResponse(
        400,
        'Invalid branch ID format'
      ));
    }

    const access = await branchAccessRepository.checkAccess(userId, branchObjectId);
    
    if (!access) {
      logWarn('Access denied - No branch access', {
        userId,
        branchId: branchObjectId.toString(),
        requestId: context.getRequestId()
      });
      return res.status(403).json(createErrorResponse(
        403,
        'Forbidden - You do not have access to this branch'
      ));
    }

    // Simpan permission ke request untuk penggunaan selanjutnya
    req.branchAccess = access;
    
    next();
  } catch (error) {
    logError('Error checking direct branch access', {
      userId,
      branchId,
      error: error.message,
      requestId: context.getRequestId()
    });
    return res.status(500).json(createErrorResponse(
      500,
      'Internal server error while checking access'
    ));
  }
}

/**
 * Middleware untuk memeriksa write permission
 * Type C: Seperti Type B tapi memerlukan permission RW
 */
async function checkWritePermission(req, res, next) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();
  const userId = context.getUserId();
  const branchId = req.params.id || req.params.branch_id; // Support both :id and :branch_id params

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    // Validasi branch_id menggunakan helper function
    const branchObjectId = validateAndConvertId(branchId);
    if (!branchObjectId) {
      logWarn('Invalid branch_id format', {
        userId,
        branchId,
        requestId: context.getRequestId()
      });
      return res.status(400).json(createErrorResponse(
        400,
        'Invalid branch ID format'
      ));
    }

    const access = await branchAccessRepository.checkAccess(userId, branchObjectId);
    
    if (!access) {
      logWarn('Access denied - No branch access', {
        userId,
        branchId: branchObjectId.toString(),
        requestId: context.getRequestId()
      });
      return res.status(403).json(createErrorResponse(
        403,
        'Forbidden - You do not have access to this branch'
      ));
    }

    if (access.permission !== 'RW') {
      logWarn('Access denied - Insufficient permission', {
        userId,
        branchId: branchObjectId.toString(),
        permission: access.permission,
        requestId: context.getRequestId()
      });
      return res.status(403).json(createErrorResponse(
        403,
        'Forbidden - You do not have write permission for this branch'
      ));
    }

    req.branchAccess = access;
    
    next();
  } catch (error) {
    logError('Error checking write permission', {
      userId,
      branchId,
      error: error.message,
      requestId: context.getRequestId()
    });
    return res.status(500).json(createErrorResponse(
      500,
      'Internal server error while checking access'
    ));
  }
}

/**
 * Fungsi helper untuk mencari branch_id dari berbagai tipe perangkat
 */
async function findBranchIdByDevice(deviceType, deviceId) {
  const branchesCollection = getCollection('branches');
  let query;

  switch (deviceType) {
    case 'router':
      query = { "children._id": deviceId };
      break;
    case 'olt':
      // OLT berada di dalam array children dari router
      query = { "children.children._id": deviceId };
      break;
    case 'odc':
      // ODC berada di dalam array children dari pon_port OLT
      query = { "children.children.pon_port.children._id": deviceId };
      break;
    case 'odp':
      // ODP berada di dalam array children dari tray ODC
      query = { "children.children.pon_port.children.trays.children._id": deviceId };
      break;
    case 'ont':
      // ONT berada di dalam array children dari ODP
      query = { "children.children.pon_port.children.trays.children.children._id": deviceId };
      break;
    default:
      throw new Error('Invalid device type');
  }

  try {
    logDebug(`Mencari ${deviceType} dengan ID ${deviceId}`, {
      query,
      deviceType,
      deviceId
    });

    const branch = await branchesCollection.findOne(query);
    
    if (!branch) {
      logDebug(`${deviceType.toUpperCase()} tidak ditemukan`, {
        deviceType,
        deviceId,
        query
      });
      return null;
    }

    logDebug(`${deviceType.toUpperCase()} ditemukan di branch ${branch._id}`, {
      deviceType,
      deviceId,
      branchId: branch._id
    });

    return branch._id;
  } catch (error) {
    logError(`Error mencari ${deviceType}`, {
      deviceType,
      deviceId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Factory function untuk membuat middleware pengecekan device
 * Type D-H: Untuk endpoint dengan device ID di URL
 */
function createDeviceAccessChecker(deviceType, requireWrite = false) {
  return async (req, res, next) => {
    const context = getRequestContext();
    const userRoles = context.getUserRoles();
    const userId = context.getUserId();
    
    // Skip untuk Client Owner
    if (userRoles.some(role => role.name === 'Client Owner')) {
      return next();
    }

    const deviceId = req.params[`${deviceType}_id`];

    try {
      // Validasi device_id menggunakan helper function
      const deviceObjectId = validateAndConvertId(deviceId);
      if (!deviceObjectId) {
        logWarn(`Invalid ${deviceType}_id format`, {
          userId,
          deviceId,
          requestId: context.getRequestId()
        });
        return res.status(400).json(createErrorResponse(
          400,
          `Invalid ${deviceType} ID format`
        ));
      }

      const branchId = await findBranchIdByDevice(deviceType, deviceObjectId);
      
      if (!branchId) {
        logWarn(`${deviceType.toUpperCase()} not found`, {
          userId,
          deviceId,
          requestId: context.getRequestId()
        });
        return res.status(404).json(createErrorResponse(
          404,
          `${deviceType.toUpperCase()} not found`
        ));
      }

      const access = await branchAccessRepository.checkAccess(userId, branchId);
      
      if (!access) {
        logWarn('Access denied - No branch access', {
          userId,
          deviceId,
          branchId: branchId.toString(),
          requestId: context.getRequestId()
        });
        return res.status(403).json(createErrorResponse(
          403,
          `Forbidden - You do not have access to this ${deviceType}`
        ));
      }

      if (requireWrite && access.permission !== 'RW') {
        logWarn('Access denied - Insufficient permission', {
          userId,
          deviceId,
          branchId: branchId.toString(),
          permission: access.permission,
          requestId: context.getRequestId()
        });
        return res.status(403).json(createErrorResponse(
          403,
          `Forbidden - You do not have write permission for this ${deviceType}`
        ));
      }

      req.branchAccess = access;
      req.branchId = branchId;
      
      next();
    } catch (error) {
      logError(`Error checking ${deviceType} access`, {
        userId,
        deviceId,
        error: error.message,
        requestId: context.getRequestId()
      });
      return res.status(500).json(createErrorResponse(
        500,
        'Internal server error while checking access'
      ));
    }
  };
}

// Export middleware factories untuk berbagai tipe device
module.exports = {
  requireClientOwner,
  checkBranchListAccess,
  checkDirectBranchAccess,
  checkWritePermission,
  checkRouterAccess: createDeviceAccessChecker('router'),
  checkOltAccess: createDeviceAccessChecker('olt'),
  checkOdcAccess: createDeviceAccessChecker('odc'),
  checkOdpAccess: createDeviceAccessChecker('odp'),
  checkOntAccess: createDeviceAccessChecker('ont'),
  checkRouterWriteAccess: createDeviceAccessChecker('router', true),
  checkOltWriteAccess: createDeviceAccessChecker('olt', true),
  checkOdcWriteAccess: createDeviceAccessChecker('odc', true),
  checkOdpWriteAccess: createDeviceAccessChecker('odp', true),
  checkOntWriteAccess: createDeviceAccessChecker('ont', true)
}; 