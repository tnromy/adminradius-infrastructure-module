/**
 * Controller untuk endpoint net device router
 */

const branchRepository = require('../repositories/branch.repository');
const routerRepository = require('../repositories/netDeviceRouter.repository');
const { softDeleteRouter } = require('../utils/recursiveSoftDelete.util');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { getRequestContext } = require('../services/requestContext.service');

/**
 * Mendapatkan router berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getRouterById(req, res) {
  try {
    const context = getRequestContext();
    const { router_id } = req.params;
    
    logDebug('Menerima request getRouterById', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      query: req.query,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    logDebug('Mengambil data router by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      filters: {
        deleted: deletedFilter
      }
    });
    
    const router = await routerRepository.getRouterById(router_id, deletedFilter);
    
    if (!router) {
      logWarn('Router tidak ditemukan', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id,
        filters: {
          deleted: deletedFilter
        }
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Router not found'
      ));
    }
    
    logInfo('Berhasil mengambil data router by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      deleted: deletedFilter
    });
    
    res.status(200).json({
      data: router
    });
  } catch (error) {
    logError('Error pada getRouterById', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      routerId: req.params.router_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Menambahkan router ke branch
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addRouterToBranch(req, res) {
  try {
    const context = getRequestContext();
    const { branch_id } = req.params;
    
    logDebug('Menerima request addRouterToBranch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: branch_id,
      userRoles: context.getUserRoles().map(r => r.name),
      requestBody: req.body
    });
    
    // Periksa apakah branch ada
    logDebug('Memeriksa keberadaan branch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: branch_id
    });
    
    const branch = await branchRepository.getBranchById(branch_id);
    
    if (!branch) {
      logWarn('Branch tidak ditemukan untuk penambahan router', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: branch_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Branch not found'
      ));
    }
    
    // Tambahkan router ke branch
    logDebug('Menambahkan router ke branch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: branch_id,
      routerLabel: req.body.label
    });
    
    const updatedBranch = await branchRepository.addRouterToBranch(branch_id, req.body);
    
    logInfo('Router berhasil ditambahkan ke branch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: branch_id,
      branchName: branch.name,
      routerLabel: req.body.label
    });
    
    res.status(200).json({
      message: 'Router added to branch successfully',
      data: updatedBranch
    });
  } catch (error) {
    logError('Error pada addRouterToBranch', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      branchId: req.params.branch_id,
      requestBody: req.body
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Melakukan soft delete pada Router dan semua OLT, ODC, ODP, serta ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteRouter(req, res) {
  try {
    const context = getRequestContext();
    const { router_id } = req.params;
    
    logDebug('Menerima request deleteRouter', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa apakah Router ada
    logDebug('Memeriksa keberadaan router sebelum dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id
    });
    
    const routerInfo = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.WITHOUT);
    
    if (!routerInfo || !routerInfo.router) {
      logWarn('Router tidak ditemukan atau sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Router not found or already deleted'
      ));
    }
    
    // Lakukan soft delete rekursif pada Router dan semua device di dalamnya
    try {
      logDebug('Memulai proses soft delete router secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id,
        routerLabel: routerInfo.router.label,
        branchId: routerInfo.branchId
      });
      
      const result = await softDeleteRouter({
        branchId: routerInfo.branchId,
        routerIndex: routerInfo.routerIndex
      });
      
      if (!result) {
        logError('Soft delete router gagal', {
          requestId: context.getRequestId(),
          userId: context.getUserId(),
          routerId: router_id,
          routerLabel: routerInfo.router.label,
          branchId: routerInfo.branchId
        });
        
        return res.status(500).json(createErrorResponse(
          500,
          'Failed to delete Router',
          { routerId: router_id }
        ));
      }
      
      logDebug('Soft delete berhasil, mengambil data Router yang sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id
      });
      
      // Dapatkan Router yang sudah di-soft delete
      const deletedRouter = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.WITH);
      
      logInfo('Router berhasil di-soft delete secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id,
        routerLabel: routerInfo.router.label,
        branchId: routerInfo.branchId
      });
      
      // Sukses, kembalikan status 200 dengan data Router yang sudah di-soft delete
      res.status(200).json({
        message: 'Router and all OLTs, ODCs, ODPs, and ONTs deleted successfully',
        data: deletedRouter?.router || { _id: router_id, deleted_at: new Date() }
      });
    } catch (deleteError) {
      logError('Error saat proses delete router', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id,
        error: deleteError.message,
        stack: deleteError.stack
      });
      
      return res.status(500).json(createErrorResponse(
        500,
        `Failed to delete Router: ${deleteError.message || 'Unknown error'}`,
        deleteError
      ));
    }
  } catch (error) {
    logError('Error pada deleteRouter controller', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      routerId: req.params.router_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Melakukan restore pada Router yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreRouter(req, res) {
  try {
    const context = getRequestContext();
    const { router_id } = req.params;
    
    logDebug('Menerima request restoreRouter', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa status Router terlebih dahulu
    logDebug('Memeriksa keberadaan router yang sudah dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id
    });
    
    const routerInfo = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.ONLY);
    
    logDebug('Status pencarian router yang dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      ditemukan: routerInfo ? true : false
    });
    
    if (!routerInfo || !routerInfo.router) {
      logWarn('Router tidak ditemukan atau sudah di-restore', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Router not found or already restored'
      ));
    }
    
    // Coba restore Router
    logDebug('Mencoba melakukan restore router secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      routerLabel: routerInfo.router.label,
      branchId: routerInfo.branchId
    });
    
    const result = await routerRepository.restore(router_id);
    
    logDebug('Hasil restore router', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      berhasil: result ? true : false
    });
    
    if (!result) {
      logError('Gagal melakukan restore router', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id,
        routerLabel: routerInfo.router.label
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Failed to restore Router'
      ));
    }
    
    // Dapatkan data Router yang sudah di-restore
    logDebug('Mengambil data router yang sudah di-restore', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id
    });
    
    const restoredRouter = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.WITH);
    
    logInfo('Router berhasil di-restore secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      routerLabel: restoredRouter?.router?.label || 'unknown',
      branchId: routerInfo.branchId
    });
    
    res.status(200).json({
      message: 'Router restored successfully',
      data: restoredRouter
    });
  } catch (error) {
    logError('Error pada restoreRouter', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      routerId: req.params.router_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

module.exports = {
  getRouterById,
  addRouterToBranch,
  deleteRouter,
  restoreRouter
}; 