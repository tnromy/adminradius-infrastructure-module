/**
 * Middleware untuk permission check pada branch access
 */

const { ObjectId } = require('mongodb');
const branchAccessRepository = require('../repositories/branchAccess.repository');
const { getRequestContext } = require('../services/requestContext.service');
const { logDebug, logError, logWarn, createErrorResponse } = require('../services/logger.service');
const { getCollection } = require('../repositories/database.connector');

/**
 * Helper untuk mencari branch_id berdasarkan device
 * @param {string} deviceType - Tipe device (router, olt, odc, odp, ont)
 * @param {string} deviceId - ID device
 * @returns {Promise<string|null>} Branch ID jika ditemukan
 */
async function findBranchIdByDevice(deviceType, deviceId) {
  try {
    const deviceObjectId = new ObjectId(deviceId);
    const branchCollection = getCollection('branches');
    let query;

    switch (deviceType) {
      case 'router':
        query = { 'children.routers._id': deviceObjectId };
        break;
      case 'olt':
        query = { 'children.routers.children.olts._id': deviceObjectId };
        break;
      case 'odc':
        query = { 'children.routers.children.olts.children.pon_ports.children.odcs._id': deviceObjectId };
        break;
      case 'odp':
        query = { 'children.routers.children.olts.children.pon_ports.children.odcs.children.trays.children.odps._id': deviceObjectId };
        break;
      case 'ont':
        query = { 'children.routers.children.olts.children.pon_ports.children.odcs.children.trays.children.odps.children.onts._id': deviceObjectId };
        break;
      default:
        throw new Error('Invalid device type');
    }

    const branch = await branchCollection.findOne(query, { projection: { _id: 1 } });
    return branch ? branch._id.toString() : null;
  } catch (error) {
    logError('Error finding branch ID by device:', error);
    throw error;
  }
}

/**
 * Middleware untuk mengecek permission pada list branches (Type A)
 */
async function branchesPermission(req, res, next) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    const branchAccessList = await branchAccessRepository.getApprovedBranchAccessByUserId(context.getUserId());
    
    // Simpan list branch access ke request context
    context.setBranchAccessList(branchAccessList);
    
    logDebug('Branch list permission checked', {
      userId: context.getUserId(),
      accessibleBranchCount: branchAccessList.length
    });

    next();
  } catch (error) {
    logError('Error checking branches permission:', error);
    return res.status(500).json(createErrorResponse(
      500,
      'Internal server error while checking branches permission'
    ));
  }
}

/**
 * Middleware untuk mengecek permission pada single branch (Type B)
 */
async function branchPermission(req, res, next) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();
  const branchId = req.params.branch_id || req.params.id;

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    const branchAccess = await branchAccessRepository.findApprovedBranchAccessByBranchIdAndUserId(
      branchId,
      context.getUserId()
    );

    if (!branchAccess) {
      logWarn('Branch access denied', {
        userId: context.getUserId(),
        branchId
      });
      return res.status(403).json(createErrorResponse(
        403,
        'Forbidden - You do not have access to this branch'
      ));
    }

    // Simpan branch access ke request context
    context.setBranchAccess(branchAccess);
    
    next();
  } catch (error) {
    logError('Error checking branch permission:', error);
    return res.status(500).json(createErrorResponse(
      500,
      'Internal server error while checking branch permission'
    ));
  }
}

/**
 * Middleware untuk mengecek write permission pada branch (Type C)
 */
async function writerBranchPermission(req, res, next) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();
  const branchId = req.params.branch_id || req.params.id;

  // Skip untuk Client Owner
  if (userRoles.some(role => role.name === 'Client Owner')) {
    return next();
  }

  try {
    const branchAccess = await branchAccessRepository.findApprovedBranchAccessByBranchIdAndUserId(
      branchId,
      context.getUserId()
    );

    if (!branchAccess || branchAccess.permission !== 'RW') {
      logWarn('Write access denied', {
        userId: context.getUserId(),
        branchId,
        permission: branchAccess?.permission
      });
      return res.status(403).json(createErrorResponse(
        403,
        'Forbidden - You do not have write access to this branch'
      ));
    }

    // Simpan branch access ke request context
    context.setBranchAccess(branchAccess);
    
    next();
  } catch (error) {
    logError('Error checking write permission:', error);
    return res.status(500).json(createErrorResponse(
      500,
      'Internal server error while checking write permission'
    ));
  }
}

/**
 * Factory untuk membuat device-specific permission middleware
 * @param {string} deviceType - Tipe device (router, olt, odc, odp, ont)
 * @param {boolean} requireWrite - Apakah memerlukan write permission
 * @returns {Function} Middleware function
 */
function createDevicePermissionMiddleware(deviceType, requireWrite = false) {
  return async (req, res, next) => {
    const context = getRequestContext();
    const userRoles = context.getUserRoles();
    const deviceId = req.params[`${deviceType}_id`];

    // Skip untuk Client Owner
    if (userRoles.some(role => role.name === 'Client Owner')) {
      return next();
    }

    try {
      const branchId = await findBranchIdByDevice(deviceType, deviceId);
      if (!branchId) {
        return res.status(404).json(createErrorResponse(
          404,
          `${deviceType.toUpperCase()} not found or not associated with any branch`
        ));
      }

      const branchAccess = await branchAccessRepository.findApprovedBranchAccessByBranchIdAndUserId(
        branchId,
        context.getUserId()
      );

      if (!branchAccess || (requireWrite && branchAccess.permission !== 'RW')) {
        logWarn(`${requireWrite ? 'Write access' : 'Access'} denied`, {
          userId: context.getUserId(),
          deviceType,
          deviceId,
          branchId,
          permission: branchAccess?.permission
        });
        return res.status(403).json(createErrorResponse(
          403,
          `Forbidden - You do not have ${requireWrite ? 'write ' : ''}access to this ${deviceType}`
        ));
      }

      // Simpan branch access ke request context
      context.setBranchAccess(branchAccess);
      
      next();
    } catch (error) {
      logError(`Error checking ${deviceType} permission:`, error);
      return res.status(500).json(createErrorResponse(
        500,
        `Internal server error while checking ${deviceType} permission`
      ));
    }
  };
}

// Create device-specific middleware (Types D-H)
const routerPermission = createDevicePermissionMiddleware('router');
const oltPermission = createDevicePermissionMiddleware('olt');
const odcPermission = createDevicePermissionMiddleware('odc');
const odpPermission = createDevicePermissionMiddleware('odp');
const ontPermission = createDevicePermissionMiddleware('ont');

// Create write permission versions
const writerRouterPermission = createDevicePermissionMiddleware('router', true);
const writerOltPermission = createDevicePermissionMiddleware('olt', true);
const writerOdcPermission = createDevicePermissionMiddleware('odc', true);
const writerOdpPermission = createDevicePermissionMiddleware('odp', true);
const writerOntPermission = createDevicePermissionMiddleware('ont', true);

module.exports = {
  branchesPermission,
  branchPermission,
  writerBranchPermission,
  routerPermission,
  oltPermission,
  odcPermission,
  odpPermission,
  ontPermission,
  writerRouterPermission,
  writerOltPermission,
  writerOdcPermission,
  writerOdpPermission,
  writerOntPermission
}; 