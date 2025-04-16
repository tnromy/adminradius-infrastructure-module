/**
 * Controller untuk endpoint branch
 */

const branchRepository = require('../repositories/branch.repository');
const { validateBranchEntity } = require('../entities/branch.entity');

/**
 * Mendapatkan semua branches
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getAllBranches(req, res) {
  try {
    // Ambil parameter result dari query
    const { result, deleted } = req.query;
    
    // Validasi parameter result jika ada
    if (result && !Object.values(branchRepository.ResultTypes).includes(result)) {
      return res.status(400).json({
        error: 'Invalid result type',
        valid_values: Object.values(branchRepository.ResultTypes)
      });
    }
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const branches = await branchRepository.getAllBranches(result, deletedFilter);
    res.status(200).json({
      data: branches
    });
  } catch (error) {
    console.error('Error in getAllBranches controller:', error);
    res.status(500).json({
      error: 'Internal server error'
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
    const { id } = req.params;
    // Ambil parameter result dan deleted dari query
    const { result, deleted } = req.query;
    
    // Validasi parameter result jika ada
    if (result && !Object.values(branchRepository.ResultTypes).includes(result)) {
      return res.status(400).json({
        error: 'Invalid result type',
        valid_values: Object.values(branchRepository.ResultTypes)
      });
    }
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const branch = await branchRepository.getBranchById(id, result, deletedFilter);
    
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

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
};
