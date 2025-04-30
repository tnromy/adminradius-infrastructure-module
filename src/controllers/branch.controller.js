/**
 * Controller untuk endpoint branch
 */

const branchRepository = require('../repositories/branch.repository');
const { validateBranchEntity } = require('../entities/branch.entity');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { getRequestContext } = require('../services/requestContext.service');
const { ResultTypes, DeletedFilterTypes } = require('../repositories/branch.repository');

/**
 * Mendapatkan semua branches
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getAllBranches(req, res) {
  const context = getRequestContext();
  const userRoles = context.getUserRoles();
  
  try {
    let accessibleBranchIds = null;

    // Jika bukan Client Owner, gunakan branch access list untuk filter
    if (!userRoles.some(role => role.name === 'Client Owner')) {
      // Dapatkan list branch ID yang diizinkan dari context
      accessibleBranchIds = context.getBranchAccessList();
      
      // Jika tidak ada branch yang diizinkan, kembalikan array kosong
      if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
        logDebug('No accessible branches found', {
          userId: context.getUserId()
        });
        return res.json({ data: [] });
      }
      
      logDebug('Filtering branches based on access', {
        userId: context.getUserId(),
        accessibleBranchCount: accessibleBranchIds.length
      });
    }

    const branches = await branchRepository.getAllBranches(
      ResultTypes.BASIC,
      DeletedFilterTypes.WITHOUT,
      accessibleBranchIds
    );

    logInfo('Successfully retrieved branches', {
      userId: context.getUserId(),
      count: branches.length
    });

    res.json({
      data: branches
    });
  } catch (error) {
    logError('Error getting branches:', error);
    res.status(500).json({
      error: 'Internal server error',
      request_id: context.getRequestId(),
      details: error.message
    });
  }
}

/**
 * Mendapatkan branch berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getBranchById(req, res) {
  try {
    const context = getRequestContext();
    const { id } = req.params;
    
    logDebug('Menerima request getBranchById', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      query: req.query,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Ambil parameter scope_level dan deleted dari query
    const { scope_level, deleted } = req.query;
    
    // Validasi parameter scope_level jika ada
    if (scope_level && !Object.values(branchRepository.ResultTypes).includes(scope_level)) {
      logWarn('Invalid scope_level parameter pada getBranchById', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: id,
        invalidValue: scope_level,
        validValues: Object.values(branchRepository.ResultTypes)
      });
      
      return res.status(400).json(createErrorResponse(
        400,
        'Invalid scope_level type',
        { valid_values: Object.values(branchRepository.ResultTypes) }
      ));
    }
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    logDebug('Mengambil data branch by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      filters: {
        scope_level: scope_level || 'default',
        deleted: deletedFilter
      }
    });
    
    const branch = await branchRepository.getBranchById(id, scope_level, deletedFilter);
    
    if (!branch) {
      logWarn('Branch tidak ditemukan', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: id,
        filters: {
          scope_level: scope_level || 'default',
          deleted: deletedFilter
        }
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Branch not found'
      ));
    }
    
    logInfo('Berhasil mengambil data branch by ID', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      scope_level: scope_level || 'default',
      deleted: deletedFilter
    });
    
    res.status(200).json({
      data: branch
    });
  } catch (error) {
    logError('Error pada getBranchById', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      branchId: req.params.id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Membuat branch baru
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function createBranch(req, res) {
  try {
    const context = getRequestContext();
    
    logDebug('Menerima request createBranch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      userRoles: context.getUserRoles().map(r => r.name),
      requestBody: req.body
    });
    
    // Validasi telah dilakukan di middleware validation
    logDebug('Membuat branch baru', {
      requestId: context.getRequestId(),
      userId: context.getUserId()
    });
    
    const branch = await branchRepository.createBranch(req.body);
    
    logInfo('Branch berhasil dibuat', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: branch._id,
      branchName: branch.name
    });
    
    res.status(200).json({
      message: 'Branch created successfully',
      data: branch
    });
  } catch (error) {
    logError('Error pada createBranch', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
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
 * Mengupdate branch berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function updateBranch(req, res) {
  try {
    const context = getRequestContext();
    const { id } = req.params;
    
    logDebug('Menerima request updateBranch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      userRoles: context.getUserRoles().map(r => r.name),
      requestBody: req.body
    });
    
    logDebug('Mengupdate branch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id
    });
    
    const branch = await branchRepository.updateBranch(id, req.body);
    
    if (!branch) {
      logWarn('Branch tidak ditemukan untuk update', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Branch not found'
      ));
    }
    
    logInfo('Branch berhasil diupdate', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      branchName: branch.name
    });
    
    res.status(200).json({
      data: branch
    });
  } catch (error) {
    logError('Error pada updateBranch', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      branchId: req.params.id,
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
 * Menghapus branch berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteBranch(req, res) {
  try {
    const context = getRequestContext();
    const { id } = req.params;
    
    logDebug('Menerima request deleteBranch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa apakah Branch ada
    logDebug('Memeriksa keberadaan branch sebelum dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id
    });
    
    const branch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.WITHOUT);
    
    if (!branch) {
      logWarn('Branch tidak ditemukan atau sudah dihapus', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Branch not found or already deleted'
      ));
    }
    
    // Import soft delete function
    const { softDeleteBranch } = require('../utils/recursiveSoftDelete.util');
    
    // Lakukan soft delete rekursif pada Branch dan semua Router, OLT, ODC, ODP, serta ONT di dalamnya
    logDebug('Melakukan soft delete rekursif pada branch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      branchName: branch.name
    });
    
    const result = await softDeleteBranch(branch._id);
    
    if (!result) {
      logError('Gagal melakukan soft delete pada branch', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: id,
        branchName: branch.name
      });
      
      return res.status(500).json(createErrorResponse(
        500,
        'Failed to delete Branch',
        { branchId: id }
      ));
    }
    
    // Dapatkan Branch yang sudah di-soft delete
    const deletedBranch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.WITH);
    
    logInfo('Branch berhasil di-soft delete secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      branchName: branch.name
    });
    
    // Sukses, kembalikan status 200 dengan data Branch yang sudah di-soft delete
    res.status(200).json({
      message: 'Branch and all Routers, OLTs, ODCs, ODPs, and ONTs deleted successfully',
      data: deletedBranch
    });
  } catch (error) {
    logError('Error pada deleteBranch', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      branchId: req.params.id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Melakukan restore pada branch yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreBranch(req, res) {
  try {
    const context = getRequestContext();
    const { id } = req.params;
    
    logDebug('Menerima request restoreBranch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    // Periksa status branch terlebih dahulu
    logDebug('Memeriksa keberadaan branch yang sudah dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id
    });
    
    const branch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.ONLY);
    
    logDebug('Status pencarian branch yang dihapus', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      ditemukan: branch ? true : false
    });
    
    if (!branch) {
      logWarn('Branch tidak ditemukan atau sudah di-restore', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: id
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Branch not found or already restored'
      ));
    }
    
    // Coba restore branch
    logDebug('Mencoba melakukan restore branch secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      branchName: branch.name
    });
    
    const result = await branchRepository.restore(id);
    
    logDebug('Hasil restore branch', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      berhasil: result ? true : false
    });
    
    if (!result) {
      logError('Gagal melakukan restore branch', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        branchId: id,
        branchName: branch.name
      });
      
      return res.status(404).json(createErrorResponse(
        404,
        'Failed to restore branch'
      ));
    }
    
    // Dapatkan data branch yang sudah di-restore
    logDebug('Mengambil data branch yang sudah di-restore', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id
    });
    
    const restoredBranch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.WITH);
    
    logInfo('Branch berhasil di-restore secara rekursif', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      branchId: id,
      branchName: restoredBranch.name
    });
    
    res.status(200).json({
      message: 'Branch restored successfully',
      data: restoredBranch
    });
  } catch (error) {
    logError('Error pada restoreBranch', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId(),
      branchId: req.params.id
    });
    
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  restoreBranch
};
