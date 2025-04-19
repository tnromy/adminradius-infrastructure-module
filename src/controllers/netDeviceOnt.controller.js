/**
 * Controller untuk endpoint net device ONT
 */

const odpRepository = require('../repositories/netDeviceOdp.repository');
const ontRepository = require('../repositories/netDeviceOnt.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes
const netDeviceOntService = require('../services/netDeviceOnt.service');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { getRequestContext } = require('../services/requestContext.service');

/**
 * Mendapatkan ONT berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOntById(req, res) {
  try {
    const context = getRequestContext();
    const { ont_id } = req.params;
    
    logDebug('Menerima request getOntById', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      query: req.query,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    const { deleted } = req.query;
    
    logDebug('Mengambil data ONT by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      filters: {
        deleted: deleted || 'WITHOUT'
      }
    });
    
    const ont = await netDeviceOntService.getOntById(ont_id, deleted);
    
    logInfo('Berhasil mengambil data ONT by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      deleted: deleted || 'WITHOUT'
    });
    
    res.status(200).json({
      data: ont
    });
  } catch (error) {
    logError('Error pada getOntById', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      ontId: req.params.ont_id
    });
    
    if (error.message === 'ONT not found') {
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
 * Melakukan soft delete pada ONT berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOnt(req, res) {
  try {
    const context = getRequestContext();
    const { ont_id } = req.params;
    
    logDebug('Menerima request deleteOnt', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa apakah ONT ada
    logDebug('Memeriksa keberadaan ONT sebelum dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id
    });
    
    const ont = await ontRepository.getOntById(ont_id, branchRepository.DeletedFilterTypes.WITHOUT);
    
    if (!ont) {
      logWarn('ONT tidak ditemukan atau sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        ontId: ont_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ONT not found or already deleted'
      ));
    }
    
    // Lakukan soft delete
    logDebug('Memulai proses soft delete ONT', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      ontLabel: ont.label || 'unknown'
    });
    
    const deletedOnt = await ontRepository.softDeleteOnt(ont_id);
    
    if (!deletedOnt) {
      logError('Soft delete ONT gagal', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        ontId: ont_id,
        ontLabel: ont.label || 'unknown'
      });
      
      return res.status(500).json(createErrorResponse(
        500,
        'Failed to delete ONT',
        { ontId: ont_id }
      ));
    }
    
    logInfo('ONT berhasil di-soft delete', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      ontLabel: ont.label || 'unknown'
    });
    
    // Sukses, kembalikan status 200 dengan data ONT yang sudah di-soft delete
    res.status(200).json({
      message: 'ONT deleted successfully',
      data: deletedOnt
    });
  } catch (error) {
    logError('Error pada deleteOnt controller', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      ontId: req.params.ont_id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Menambahkan ONT ke ODP
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOntToOdp(req, res) {
  try {
    const context = getRequestContext();
    const { odp_id } = req.params;
    
    logDebug('Menerima request addOntToOdp', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      userRoles: context.getUserRoles().map(r => r.name),
      requestBody: req.body
    });
    
    // Periksa apakah ODP ada
    logDebug('Memeriksa keberadaan ODP', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id
    });
    
    const odpInfo = await odpRepository.getOdpById(odp_id);
    
    if (!odpInfo || !odpInfo.odp) {
      logWarn('ODP tidak ditemukan untuk penambahan ONT', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'ODP not found'
      ));
    }
    
    // Periksa kapasitas port ODP
    const maxAvailablePort = odpInfo.odp.available_port || 0;
    const currentOntCount = odpInfo.odp.children ? odpInfo.odp.children.length : 0;
    
    logDebug('Memeriksa kapasitas port ODP', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      odpLabel: odpInfo.odp.label || 'unknown',
      maxAvailablePort: maxAvailablePort,
      currentOntCount: currentOntCount
    });
    
    if (currentOntCount >= maxAvailablePort) {
      logWarn('Kapasitas port ODP terlampaui', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odp_id,
        odpLabel: odpInfo.odp.label || 'unknown',
        maxAvailablePort: maxAvailablePort,
        currentOntCount: currentOntCount
      });
      
      return res.status(400).json(createErrorResponse(
        400,
        `ODP port capacity exceeded. Maximum port: ${maxAvailablePort}, current ONT count: ${currentOntCount}`
      ));
    }
    
    // Tambahkan ONT ke ODP
    logDebug('Menambahkan ONT ke ODP', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      odpLabel: odpInfo.odp.label || 'unknown',
      ontLabel: req.body.label
    });
    
    const updatedOdpInfo = await odpRepository.addOntToOdp(odp_id, req.body);
    
    logInfo('ONT berhasil ditambahkan ke ODP', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odp_id,
      odpLabel: odpInfo.odp.label || 'unknown',
      ontLabel: req.body.label
    });
    
    res.status(200).json({
      message: 'ONT added to ODP successfully',
      data: updatedOdpInfo.odp
    });
  } catch (error) {
    logError('Error pada addOntToOdp', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      odpId: req.params.odp_id,
      requestBody: req.body
    });
    
    // Handling specific errors
    if (error.message && (error.message.includes('not found') || error.message.includes('exceeded'))) {
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
 * Melakukan restore pada ONT yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreOnt(req, res) {
  try {
    const context = getRequestContext();
    const { ont_id } = req.params;
    
    logDebug('Menerima request restoreOnt', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    logDebug('Mencoba melakukan restore ONT', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id
    });
    
    const ont = await netDeviceOntService.restoreOnt(ont_id);
    
    logInfo('ONT berhasil di-restore', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      ontId: ont_id,
      ontLabel: ont.label || 'unknown'
    });
    
    res.status(200).json({
      message: 'ONT restored successfully',
      data: ont
    });
  } catch (error) {
    logError('Error pada restoreOnt', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      ontId: req.params.ont_id
    });
    
    if (error.message === 'ONT not found or already restored') {
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

module.exports = {
  getOntById,
  addOntToOdp,
  deleteOnt,
  restoreOnt
}; 