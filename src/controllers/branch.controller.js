/**
 * Controller untuk endpoint branch
 */

const branchRepository = require('../repositories/branch.repository');
const { validateBranchEntity } = require('../entities/branch.entity');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { getRequestContext } = require('../services/requestContext.service');

/**
 * Mendapatkan semua branches
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getAllBranches(req, res) {
  try {
    const context = getRequestContext();
    logDebug('Menerima request getAllBranches', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      query: req.query,
      userRoles: context.getUserRoles().map(r => r.name)
    });
    
    const { scope_level, deleted } = req.query;
    
    if (scope_level && !Object.values(branchRepository.ResultTypes).includes(scope_level)) {
      logWarn('Invalid scope_level parameter', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        invalidValue: scope_level,
        validValues: Object.values(branchRepository.ResultTypes)
      });
      return res.status(400).json(createErrorResponse(
        400,
        'Invalid scope_level type',
        { valid_values: Object.values(branchRepository.ResultTypes) }
      ));
    }
    
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }

    logDebug('Mengambil data branches', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      filters: {
        scope_level: scope_level || 'default',
        deleted: deletedFilter
      }
    });
    
    const branches = await branchRepository.getAllBranches(scope_level, deletedFilter);
    
    logInfo('Berhasil mengambil data branches', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      count: branches.length,
      scope_level: scope_level || 'default',
      deleted: deletedFilter
    });
    
    res.status(200).json({
      data: branches
    });
  } catch (error) {
    logError('Error pada getAllBranches', {
      requestId: getRequestContext().getRequestId(),
      error: error.message,
      stack: error.stack,
      userId: getRequestContext().getUserId()
    });
    res.status(500).json(createErrorResponse(
      500,
      'Internal server error',
      error
    ));
  }
}

/**
 * Mendapatkan branch berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getBranchById(req, res) {
  try {
    const { id } = req.params;
    // Ambil parameter scope_level dan deleted dari query
    const { scope_level, deleted } = req.query;
    
    // Validasi parameter scope_level jika ada
    if (scope_level && !Object.values(branchRepository.ResultTypes).includes(scope_level)) {
      return res.status(400).json({
        error: 'Invalid scope_level type',
        valid_values: Object.values(branchRepository.ResultTypes)
      });
    }
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const branch = await branchRepository.getBranchById(id, scope_level, deletedFilter);
    
    if (!branch) {
      return res.status(404).json({
        error: 'Branch not found'
      });
    }
    
    res.status(200).json({
      data: branch
    });
  } catch (error) {
    console.error('Error in getBranchById controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Membuat branch baru
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function createBranch(req, res) {
  try {
    // Validasi telah dilakukan di middleware validation
    const branch = await branchRepository.createBranch(req.body);
    res.status(200).json({
      message: 'Branch created successfully',
      data: branch
    });
  } catch (error) {
    console.error('Error in createBranch controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Mengupdate branch berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function updateBranch(req, res) {
  try {
    const { id } = req.params;
    const branch = await branchRepository.updateBranch(id, req.body);
    
    if (!branch) {
      return res.status(404).json({
        error: 'Branch not found'
      });
    }
    
    res.status(200).json({
      data: branch
    });
  } catch (error) {
    console.error('Error in updateBranch controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Menghapus branch berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteBranch(req, res) {
  try {
    const { id } = req.params;
    
    // Periksa apakah Branch ada
    const branch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.WITHOUT);
    if (!branch) {
      return res.status(404).json({
        error: 'Branch not found or already deleted'
      });
    }
    
    // Import soft delete function
    const { softDeleteBranch } = require('../utils/recursiveSoftDelete.util');
    
    // Lakukan soft delete rekursif pada Branch dan semua Router, OLT, ODC, ODP, serta ONT di dalamnya
    const result = await softDeleteBranch(branch._id);
    
    if (!result) {
      return res.status(500).json({
        error: 'Failed to delete Branch'
      });
    }
    
    // Dapatkan Branch yang sudah di-soft delete
    const deletedBranch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.WITH);
    
    // Sukses, kembalikan status 200 dengan data Branch yang sudah di-soft delete
    res.status(200).json({
      message: 'Branch and all Routers, OLTs, ODCs, ODPs, and ONTs deleted successfully',
      data: deletedBranch
    });
  } catch (error) {
    console.error('Error in deleteBranch controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Melakukan restore pada branch yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreBranch(req, res) {
  try {
    const { id } = req.params;
    console.log(`[restoreBranch] Mencoba restore branch dengan ID: ${id}`);
    
    // Periksa status branch terlebih dahulu
    const branch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.ONLY);
    console.log(`[restoreBranch] Status pencarian branch yang dihapus:`, branch ? 'Ditemukan' : 'Tidak ditemukan');
    
    if (!branch) {
      console.log(`[restoreBranch] Branch dengan ID ${id} tidak ditemukan atau sudah di-restore`);
      return res.status(404).json({
        error: 'Branch not found or already restored'
      });
    }
    
    // Coba restore branch
    console.log(`[restoreBranch] Mencoba melakukan restore branch`);
    const result = await branchRepository.restore(id);
    console.log(`[restoreBranch] Hasil restore:`, result ? 'Berhasil' : 'Gagal');
    
    if (!result) {
      console.log(`[restoreBranch] Gagal melakukan restore branch`);
      return res.status(404).json({
        error: 'Failed to restore branch'
      });
    }
    
    // Dapatkan data branch yang sudah di-restore
    console.log(`[restoreBranch] Mengambil data branch yang sudah di-restore`);
    const restoredBranch = await branchRepository.getBranchById(id, null, branchRepository.DeletedFilterTypes.WITH);
    console.log(`[restoreBranch] Data branch yang sudah di-restore:`, restoredBranch ? 'Ditemukan' : 'Tidak ditemukan');
    
    res.status(200).json({
      message: 'Branch restored successfully',
      data: restoredBranch
    });
  } catch (error) {
    console.error('Error in restoreBranch controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
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
