/**
 * Controller untuk endpoint net device ODP
 */

const odcRepository = require('../repositories/netDeviceOdc.repository');
const odpRepository = require('../repositories/netDeviceOdp.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes
const { softDeleteOdp } = require('../utils/recursiveSoftDelete.util');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { getRequestContext } = require('../services/requestContext.service');

/**
 * Mendapatkan ODP berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOdpById(req, res) {
  try {
    const context = getRequestContext();
    const { odp_id } = req.params;
    
    logDebug('Menerima request getOdpById', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      query: req.query,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    logDebug('Mengambil data ODP by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      filters: {
        deleted: deletedFilter
      }
    });
    
    const odp = await odpRepository.getOdpById(odp_id, deletedFilter);
    
    if (!odp) {
      logWarn('ODP tidak ditemukan', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id,
        filters: {
          deleted: deletedFilter
        }
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODP not found'
      ));
    }
    
    logInfo('Berhasil mengambil data ODP by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      deleted: deletedFilter
    });
    
    res.status(200).json({
      data: odp
    });
  } catch (error) {
    logError('Error pada getOdpById', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odpId: req.params.odp_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Menambahkan ODP ke ODC pada tray tertentu
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOdpToOdc(req, res) {
  try {
    const context = getRequestContext();
    const { odc_id } = req.params;
    
    logDebug('Menerima request addOdpToOdc', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      userRoles: context.getUserRoles().map(r => r.name),
      requestBody: req.body
    });
    
    // Periksa apakah ODC ada
    logDebug('Memeriksa keberadaan ODC', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id
    });
    
    const odcInfo = await odcRepository.getOdcById(odc_id);
    
    if (!odcInfo || !odcInfo.odc) {
      logWarn('ODC tidak ditemukan untuk penambahan ODP', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODC not found'
      ));
    }
    
    // Periksa apakah tray yang dimaksud ada di ODC
    logDebug('Memeriksa keberadaan tray pada ODC', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      requestedTray: req.body.tray
    });
    
    const tray = odcInfo.odc.trays.find(tray => tray.tray === req.body.tray);
    
    if (!tray) {
      logWarn('Tray tidak ditemukan pada ODC', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id,
        requestedTray: req.body.tray
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        `Tray ${req.body.tray} not found on ODC`
      ));
    }
    
    // Validasi core_on_odc_tray
    logDebug('Validasi core_on_odc_tray', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      tray: req.body.tray,
      coreOnOdcTray: req.body.core_on_odc_tray,
      validRange: `${tray.start_core}-${tray.end_core}`
    });
    
    if (req.body.core_on_odc_tray < tray.start_core || req.body.core_on_odc_tray > tray.end_core) {
      logWarn('Nilai core_on_odc_tray tidak valid', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odcId: odc_id,
        tray: req.body.tray,
        coreOnOdcTray: req.body.core_on_odc_tray,
        validRange: `${tray.start_core}-${tray.end_core}`
      });
      
      return res.status(400).json(createErrorResponse(
        400,
        `core_on_odc_tray value (${req.body.core_on_odc_tray}) out of range for tray ${req.body.tray}. Valid range: ${tray.start_core}-${tray.end_core}`
      ));
    }
    
    // Tambahkan ODP ke ODC pada tray tertentu
    logDebug('Menambahkan ODP ke ODC', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      tray: req.body.tray,
      odpLabel: req.body.label,
      coreOnOdcTray: req.body.core_on_odc_tray
    });
    
    const updatedOdcInfo = await odcRepository.addOdpToOdc(odc_id, req.body);
    
    logInfo('ODP berhasil ditambahkan ke ODC', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odcId: odc_id,
      odcLabel: odcInfo.odc.label || 'unknown',
      tray: req.body.tray,
      odpLabel: req.body.label
    });
    
    res.status(200).json({
      message: 'ODP added to ODC successfully',
      data: updatedOdcInfo.odc
    });
  } catch (error) {
    logError('Error pada addOdpToOdc', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odcId: req.params.odc_id,
      requestBody: req.body
    });
    
    // Handling specific errors
    if (error.message && (error.message.includes('not found') || error.message.includes('out of range'))) {
      return res.status(400).json(createErrorResponse(
        400,
        error.message,
        error
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
 * Melakukan soft delete pada ODP dan semua ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOdp(req, res) {
  try {
    const context = getRequestContext();
    const { odp_id } = req.params;
    
    logDebug('Menerima request deleteOdp', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa apakah ODP ada
    logDebug('Memeriksa keberadaan ODP sebelum dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id
    });
    
    const odpInfo = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.WITHOUT);
    
    if (!odpInfo || !odpInfo.odp) {
      logWarn('ODP tidak ditemukan atau sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODP not found or already deleted'
      ));
    }
    
    // Lakukan soft delete rekursif pada ODP dan semua ONT di dalamnya
    try {
      logDebug('Memulai proses soft delete ODP secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id,
        odpLabel: odpInfo.odp.label,
        branchId: odpInfo.branchId,
        routerIndex: odpInfo.routerIndex,
        oltIndex: odpInfo.oltIndex,
        ponPortIndex: odpInfo.ponPortIndex,
        odcIndex: odpInfo.odcIndex,
        trayIndex: odpInfo.trayIndex
      });
      
      const result = await softDeleteOdp({
        branchId: odpInfo.branchId,
        routerIndex: odpInfo.routerIndex,
        oltIndex: odpInfo.oltIndex,
        ponPortIndex: odpInfo.ponPortIndex,
        odcIndex: odpInfo.odcIndex,
        trayIndex: odpInfo.trayIndex,
        odpIndex: odpInfo.odpIndex
      });
      
      if (!result) {
        logError('Soft delete ODP gagal', {
          requestId: context.getRequestId(),
          userId: context.getUserId(),
          odpId: odp_id,
          odpLabel: odpInfo.odp.label,
          branchId: odpInfo.branchId
        });
        
        return res.status(500).json(createErrorResponse(
          500,
          'Failed to delete ODP',
          { odpId: odp_id }
        ));
      }
      
      logDebug('Soft delete berhasil, mengambil data ODP yang sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id
      });
      
      // Dapatkan ODP yang sudah di-soft delete
      const deletedOdp = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.WITH);
      
      logInfo('ODP berhasil di-soft delete secara rekursif', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id,
        odpLabel: odpInfo.odp.label,
        branchId: odpInfo.branchId
      });
      
      // Sukses, kembalikan status 200 dengan data ODP yang sudah di-soft delete
      res.status(200).json({
        message: 'ODP and all ONTs deleted successfully',
        data: deletedOdp?.odp || { _id: odp_id, deleted_at: new Date() }
      });
    } catch (deleteError) {
      logError('Error saat proses delete ODP', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id,
        error: deleteError.message,
        stack: deleteError.stack
      });
      
      return res.status(500).json(createErrorResponse(
        500,
        `Failed to delete ODP: ${deleteError.message || 'Unknown error'}`,
        deleteError
      ));
    }
  } catch (error) {
    logError('Error pada deleteOdp controller', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odpId: req.params.odp_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Melakukan restore pada ODP yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreOdp(req, res) {
  try {
    const context = getRequestContext();
    const { odp_id } = req.params;
    
    logDebug('Menerima request restoreOdp', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa status ODP terlebih dahulu
    logDebug('Memeriksa keberadaan ODP yang sudah dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id
    });
    
    const odpInfo = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.ONLY);
    
    logDebug('Status pencarian ODP yang dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      ditemukan: odpInfo ? true : false
    });
    
    if (!odpInfo || !odpInfo.odp) {
      logWarn('ODP tidak ditemukan atau sudah di-restore', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODP not found or already restored'
      ));
    }
    
    // Coba restore ODP
    logDebug('Mencoba melakukan restore ODP secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      odpLabel: odpInfo.odp.label,
      branchId: odpInfo.branchId
    });
    
    const result = await odpRepository.restore(odp_id);
    
    logDebug('Hasil restore ODP', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      berhasil: result ? true : false
    });
    
    if (!result) {
      logError('Gagal melakukan restore ODP', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id,
        odpLabel: odpInfo.odp.label
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Failed to restore ODP'
      ));
    }
    
    // Dapatkan data ODP yang sudah di-restore
    logDebug('Mengambil data ODP yang sudah di-restore', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id
    });
    
    const restoredOdp = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.WITH);
    
    logInfo('ODP berhasil di-restore secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      odpLabel: restoredOdp?.odp?.label || 'unknown',
      branchId: odpInfo.branchId
    });
    
    res.status(200).json({
      message: 'ODP restored successfully',
      data: restoredOdp
    });
  } catch (error) {
    logError('Error pada restoreOdp', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odpId: req.params.odp_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

module.exports = {
  getOdpById,
  addOdpToOdc,
  deleteOdp,
  restoreOdp
}; 