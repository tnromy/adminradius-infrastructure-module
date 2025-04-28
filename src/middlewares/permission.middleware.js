const { ObjectId } = require('mongodb');
const branchAccessRepository = require('../repositories/branchAccess.repository');
const { getRequestContext } = require('../services/requestContext.service');
const { logDebug, logError, createErrorResponse } = require('../services/logger.service');
const { getCollection } = require('../repositories/database.connector');

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
  const branchId = req.params.branch_id;

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    const access = await branchAccessRepository.checkAccess(userId, branchId);
    
    if (!access) {
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
      error: error.message
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
  const branchId = req.params.branch_id;

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    const access = await branchAccessRepository.checkAccess(userId, branchId);
    
    if (!access || access.permission !== 'RW') {
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
      error: error.message
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
      query = { "children.id": deviceId };
      break;
    case 'olt':
      query = { "children.children.id": deviceId };
      break;
    case 'odc':
      query = { "children.children.pon_ports.children.id": deviceId };
      break;
    case 'odp':
      query = { "children.children.pon_ports.children.trays.children.id": deviceId };
      break;
    case 'ont':
      query = { "children.children.pon_ports.children.trays.children.children.id": deviceId };
      break;
    default:
      throw new Error('Invalid device type');
  }

  const branch = await branchesCollection.findOne(query);
  return branch ? branch._id : null;
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
      const branchId = await findBranchIdByDevice(deviceType, deviceId);
      
      if (!branchId) {
        return res.status(404).json(createErrorResponse(
          404,
          `${deviceType.toUpperCase()} not found`
        ));
      }

      const access = await branchAccessRepository.checkAccess(userId, branchId);
      
      if (!access || (requireWrite && access.permission !== 'RW')) {
        return res.status(403).json(createErrorResponse(
          403,
          `Forbidden - You do not have ${requireWrite ? 'write ' : ''}permission for this ${deviceType}`
        ));
      }

      req.branchAccess = access;
      req.branchId = branchId;
      
      next();
    } catch (error) {
      logError(`Error checking ${deviceType} access`, {
        userId,
        deviceId,
        error: error.message
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