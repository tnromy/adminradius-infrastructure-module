/**
 * Controller untuk endpoint net device ODC
 */

const oltRepository = require('../repositories/netDeviceOlt.repository');
const odcRepository = require('../repositories/netDeviceOdc.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes
const { softDeleteOdc } = require('../utils/recursiveSoftDelete.util');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { getRequestContext } = require('../services/requestContext.service');

/**
 * Mendapatkan ODC berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOdcById(req, res) {
  try {
    const context = getRequestContext();
    const { odc_id } = req.params;
    
    logDebug('Menerima request getOdcById', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
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
    
    logDebug('Mengambil data ODC by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      filters: {
        deleted: deletedFilter
      }
    });
    
    const odc = await odcRepository.getOdcById(odc_id, deletedFilter);
    
    if (!odc) {
      logWarn('ODC tidak ditemukan', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id,
        filters: {
          deleted: deletedFilter
        }
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODC not found'
      ));
    }
    
    logInfo('Berhasil mengambil data ODC by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      deleted: deletedFilter
    });
    
    res.status(200).json({
      data: odc
    });
  } catch (error) {
    logError('Error pada getOdcById', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odcId: req.params.odc_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Menambahkan ODC ke OLT pada port tertentu
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOdcToOlt(req, res) {
  try {
    const context = getRequestContext();
    const { olt_id } = req.params;
    
    logDebug('Menerima request addOdcToOlt', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      userRoles: context.getUserRoles().map(r => r.name),
      requestBody: req.body
    });
    
    // Periksa apakah OLT ada
    logDebug('Memeriksa keberadaan OLT', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id
    });
    
    const oltInfo = await oltRepository.getOltById(olt_id);
    
    if (!oltInfo || !oltInfo.olt) {
      logWarn('OLT tidak ditemukan untuk penambahan ODC', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'OLT not found'
      ));
    }
    
    // Periksa apakah port yang dimaksud ada di OLT
    logDebug('Memeriksa keberadaan port pada OLT', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      requestedPort: req.body.pon_port
    });
    
    const ponPort = oltInfo.olt.pon_port.find(port => port.port === req.body.pon_port);
    
    if (!ponPort) {
      logWarn('Port tidak ditemukan pada OLT', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        oltId: olt_id,
        requestedPort: req.body.pon_port
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        `Port ${req.body.pon_port} not found on OLT`
      ));
    }
    
    // Tambahkan ODC ke OLT pada port tertentu
    logDebug('Menambahkan ODC ke OLT', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      ponPort: req.body.pon_port,
      odcLabel: req.body.label,
      availableTray: req.body.available_tray || 0,
      coresPerTray: req.body.cores_per_tray || 0
    });
    
    const updatedOltInfo = await oltRepository.addOdcToOlt(olt_id, req.body);
    
    logInfo('ODC berhasil ditambahkan ke OLT', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      oltId: olt_id,
      oltLabel: oltInfo.olt.label || 'unknown',
      ponPort: req.body.pon_port,
      odcLabel: req.body.label
    });
    
    res.status(200).json({
      message: 'ODC added to OLT successfully',
      data: updatedOltInfo.olt
    });
  } catch (error) {
    logError('Error pada addOdcToOlt', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      oltId: req.params.olt_id,
      requestBody: req.body
    });
    
    // Handling specific errors
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json(createErrorResponse(
        404,
        error.message
      ));
    }
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Melakukan soft delete pada ODC dan semua ODP serta ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOdc(req, res) {
  try {
    const context = getRequestContext();
    const { odc_id } = req.params;
    
    logDebug('Menerima request deleteOdc', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa apakah ODC ada
    logDebug('Memeriksa keberadaan ODC sebelum dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id
    });
    
    const odcInfo = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.WITHOUT);
    
    if (!odcInfo || !odcInfo.odc) {
      logWarn('ODC tidak ditemukan atau sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODC not found or already deleted'
      ));
    }
    
    // Lakukan soft delete rekursif pada ODC dan semua ODP serta ONT di dalamnya
    try {
      logDebug('Memulai proses soft delete ODC secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id,
        odcLabel: odcInfo.odc.label,
        branchId: odcInfo.branchId,
        routerIndex: odcInfo.routerIndex,
        oltIndex: odcInfo.oltIndex,
        ponPortIndex: odcInfo.ponPortIndex
      });
      
      const result = await softDeleteOdc({
        branchId: odcInfo.branchId,
        routerIndex: odcInfo.routerIndex,
        oltIndex: odcInfo.oltIndex,
        ponPortIndex: odcInfo.ponPortIndex,
        odcIndex: odcInfo.odcIndex
      });
      
      if (!result) {
        logError('Soft delete ODC gagal', {
          requestId: context.getRequestId(),
          userId: context.getUserId(),
          odcId: odc_id,
          odcLabel: odcInfo.odc.label,
          branchId: odcInfo.branchId
        });
        
        return res.status(500).json(createErrorResponse(
          500,
          'Failed to delete ODC',
          { odcId: odc_id }
        ));
      }
      
      logDebug('Soft delete berhasil, mengambil data ODC yang sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id
      });
      
      // Dapatkan ODC yang sudah di-soft delete
      const deletedOdc = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.WITH);
      
      logInfo('ODC berhasil di-soft delete secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id,
        odcLabel: odcInfo.odc.label,
        branchId: odcInfo.branchId
      });
      
      // Sukses, kembalikan status 200 dengan data ODC yang sudah di-soft delete
      res.status(200).json({
        message: 'ODC and all ODPs and ONTs deleted successfully',
        data: deletedOdc?.odc || { _id: odc_id, deleted_at: new Date() }
      });
    } catch (deleteError) {
      logError('Error saat proses delete ODC', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id,
        error: deleteError.message,
        stack: deleteError.stack
      });
      
      return res.status(500).json(createErrorResponse(
        500,
        `Failed to delete ODC: ${deleteError.message || 'Unknown error'}`,
        deleteError
      ));
    }
  } catch (error) {
    logError('Error pada deleteOdc controller', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odcId: req.params.odc_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Melakukan restore pada ODC yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreOdc(req, res) {
  try {
    const context = getRequestContext();
    const { odc_id } = req.params;
    
    logDebug('Menerima request restoreOdc', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa status ODC terlebih dahulu - gunakan filter ONLY untuk mencari yang sudah dihapus
    logDebug('Memeriksa keberadaan ODC yang sudah dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id
    });
    
    const odcInfo = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.ONLY);
    
    logDebug('Status pencarian ODC yang dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      ditemukan: odcInfo ? true : false
    });
    
    if (!odcInfo || !odcInfo.odc) {
      logWarn('ODC tidak ditemukan atau sudah di-restore', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODC not found or already restored'
      ));
    }
    
    // Coba restore ODC
    logDebug('Mencoba melakukan restore ODC secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      odcLabel: odcInfo.odc.label,
      branchId: odcInfo.branchId
    });
    
    const result = await odcRepository.restore(odc_id);
    
    logDebug('Hasil restore ODC', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      berhasil: result ? true : false
    });
    
    if (!result) {
      logError('Gagal melakukan restore ODC', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id,
        odcLabel: odcInfo.odc.label
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Failed to restore ODC'
      ));
    }
    
    // Dapatkan data ODC yang sudah di-restore menggunakan filter WITH untuk memastikan kita bisa menemukannya
    logDebug('Mengambil data ODC yang sudah di-restore', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id
    });
    
    const restoredOdc = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.WITH);
    
    logInfo('ODC berhasil di-restore secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      odcLabel: restoredOdc?.odc?.label || 'unknown',
      branchId: odcInfo.branchId
    });
    
    res.status(200).json({
      message: 'ODC restored successfully',
      data: restoredOdc
    });
  } catch (error) {
    logError('Error pada restoreOdc', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odcId: req.params.odc_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

module.exports = {
  getOdcById,
  addOdcToOlt,
  deleteOdc,
  restoreOdc
}; 