/**
 * Controller untuk endpoint branch
 */

const branchRepository = require('../repositories/branch.repository');

/**
 * Mendapatkan semua branches
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getAllBranches(req, res) {
  try {
    const branches = await branchRepository.getAllBranches();
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
    const branch = await branchRepository.getBranchById(id);
    
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
    const branch = await branchRepository.createBranch(req.body);
    res.status(201).json({
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
    const deleted = await branchRepository.deleteBranch(id);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Branch not found'
      });
    }
    
    res.status(204).end();
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
