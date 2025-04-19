/**
 * Controller untuk endpoint net device OLT
 */

const routerRepository = require('../repositories/netDeviceRouter.repository');
const oltRepository = require('../repositories/netDeviceOlt.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes
const { softDeleteOlt } = require('../utils/recursiveSoftDelete.util');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { getRequestContext } = require('../services/requestContext.service');

/**
 * Mendapatkan OLT berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOltById(req, res) {
  try {
    const context = getRequestContext();
    const { olt_id } = req.params;
    
    logDebug('Menerima request getOltById', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      query: req.query,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Ambil parameter dari query
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    logDebug('Mengambil data OLT by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      filters: {
        deleted: deletedFilter
      }
    });
    
    const olt = await oltRepository.getOltById(olt_id, deletedFilter);
    
    if (!olt) {
      logWarn('OLT tidak ditemukan', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id,
        filters: {
          deleted: deletedFilter
        }
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'OLT not found'
      ));
    }
    
    logInfo('Berhasil mengambil data OLT by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      deleted: deletedFilter
    });
    
    res.status(200).json({
      data: olt
    });
  } catch (error) {
    logError('Error pada getOltById', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      oltId: req.params.olt_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Menambahkan OLT ke router
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOltToRouter(req, res) {
  try {
    const context = getRequestContext();
    const { router_id } = req.params;
    
    logDebug('Menerima request addOltToRouter', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      userRoles: context.getUserRoles().map(r => r.name),
      requestBody: req.body
    });
    
    // Periksa apakah router ada
    logDebug('Memeriksa keberadaan router', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id
    });
    
    const router = await routerRepository.getRouterById(router_id);
    
    if (!router) {
      logWarn('Router tidak ditemukan untuk penambahan OLT', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        routerId: router_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Router not found'
      ));
    }
    
    // Tambahkan OLT ke router
    logDebug('Menambahkan OLT ke router', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      oltLabel: req.body.label,
      availablePorts: req.body.available_pon || 0
    });
    
    const updatedRouter = await routerRepository.addOltToRouter(router_id, req.body);
    
    logInfo('OLT berhasil ditambahkan ke router', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      routerId: router_id,
      routerLabel: router.router?.label || 'unknown',
      oltLabel: req.body.label
    });
    
    res.status(200).json({
      message: 'OLT added to router successfully',
      data: updatedRouter
    });
  } catch (error) {
    logError('Error pada addOltToRouter', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      routerId: req.params.router_id,
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
 * Melakukan soft delete pada OLT dan semua ODC, ODP, serta ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOlt(req, res) {
  try {
    const context = getRequestContext();
    const { olt_id } = req.params;
    
    logDebug('Menerima request deleteOlt', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa apakah OLT ada
    logDebug('Memeriksa keberadaan OLT sebelum dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id
    });
    
    const oltInfo = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.WITHOUT);
    
    if (!oltInfo || !oltInfo.olt) {
      logWarn('OLT tidak ditemukan atau sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'OLT not found or already deleted'
      ));
    }
    
    // Lakukan soft delete rekursif pada OLT dan semua ODC, ODP, serta ONT di dalamnya
    try {
      logDebug('Memulai proses soft delete OLT secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id,
        oltLabel: oltInfo.olt.label,
        branchId: oltInfo.branchId,
        routerIndex: oltInfo.routerIndex
      });
      
      const result = await softDeleteOlt({
        branchId: oltInfo.branchId,
        routerIndex: oltInfo.routerIndex,
        oltIndex: oltInfo.oltIndex
      });
      
      // Periksa hasil soft delete (result adalah boolean)
      if (!result) {
        logError('Soft delete OLT gagal', {
          requestId: context.getRequestId(),
          userId: context.getUserId(),
          oltId: olt_id,
          oltLabel: oltInfo.olt.label,
          branchId: oltInfo.branchId
        });
        
        return res.status(500).json(createErrorResponse(
          500,
          'Failed to delete OLT',
          { oltId: olt_id }
        ));
      }
      
      logDebug('Soft delete berhasil, mengambil data OLT yang sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id
      });
      
      // Dapatkan OLT yang sudah di-soft delete
      const deletedOlt = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.WITH);
      
      logInfo('OLT berhasil di-soft delete secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id,
        oltLabel: oltInfo.olt.label,
        branchId: oltInfo.branchId
      });
      
      // Sukses, kembalikan status 200 dengan data OLT yang sudah di-soft delete
      res.status(200).json({
        message: 'OLT and all ODCs, ODPs, and ONTs deleted successfully',
        data: deletedOlt?.olt || { _id: olt_id, deleted_at: new Date() }
      });
    } catch (deleteError) {
      logError('Error saat proses delete OLT', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id,
        error: deleteError.message,
        stack: deleteError.stack
      });
      
      return res.status(500).json(createErrorResponse(
        500,
        `Failed to delete OLT: ${deleteError.message || 'Unknown error'}`,
        deleteError
      ));
    }
  } catch (error) {
    logError('Error pada deleteOlt controller', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      oltId: req.params.olt_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Melakukan restore pada OLT yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreOlt(req, res) {
  try {
    const context = getRequestContext();
    const { olt_id } = req.params;
    
    logDebug('Menerima request restoreOlt', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa status OLT terlebih dahulu - gunakan filter ONLY untuk mencari yang sudah dihapus
    logDebug('Memeriksa keberadaan OLT yang sudah dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id
    });
    
    const oltInfo = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.ONLY);
    
    logDebug('Status pencarian OLT yang dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      ditemukan: oltInfo ? true : false
    });
    
    if (!oltInfo || !oltInfo.olt) {
      logWarn('OLT tidak ditemukan atau sudah di-restore', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'OLT not found or already restored'
      ));
    }
    
    // Coba restore OLT
    logDebug('Mencoba melakukan restore OLT secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      oltLabel: oltInfo.olt.label,
      branchId: oltInfo.branchId
    });
    
    const result = await oltRepository.restore(olt_id);
    
    logDebug('Hasil restore OLT', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      berhasil: result ? true : false
    });
    
    if (!result) {
      logError('Gagal melakukan restore OLT', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id,
        oltLabel: oltInfo.olt.label
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Failed to restore OLT'
      ));
    }
    
    // Dapatkan data OLT yang sudah di-restore menggunakan filter WITH untuk memastikan kita bisa menemukannya
    logDebug('Mengambil data OLT yang sudah di-restore', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id
    });
    
    const restoredOlt = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.WITH);
    
    logInfo('OLT berhasil di-restore secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      oltLabel: restoredOlt?.olt?.label || 'unknown',
      branchId: oltInfo.branchId
    });
    
    res.status(200).json({
      message: 'OLT restored successfully',
      data: restoredOlt
    });
  } catch (error) {
    logError('Error pada restoreOlt', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      oltId: req.params.olt_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

module.exports = {
  getOltById,
  addOltToRouter,
  deleteOlt,
  restoreOlt
}; 