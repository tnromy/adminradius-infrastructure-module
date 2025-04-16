/**
 * Controller untuk endpoint net device router
 */

const branchRepository = require('../repositories/branch.repository');
const routerRepository = require('../repositories/netDeviceRouter.repository');

/**
 * Mendapatkan router berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getRouterById(req, res) {
  try {
    const { router_id } = req.params;
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const router = await routerRepository.getRouterById(router_id, deletedFilter);
    
    if (!router) {
      return res.status(404).json({
        error: 'Router not found'
      });
    }
    
    res.status(200).json({
      data: router
    });
  } catch (error) {
    console.error('Error in getRouterById controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Menambahkan router ke branch
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addRouterToBranch(req, res) {
  try {
    const { branch_id } = req.params;
    
    // Periksa apakah branch ada
    const branch = await branchRepository.getBranchById(branch_id);
    if (!branch) {
      return res.status(404).json({
        error: 'Branch not found'
      });
    }
    
    // Tambahkan router ke branch
    const updatedBranch = await branchRepository.addRouterToBranch(branch_id, req.body);
    
    res.status(200).json({
      message: 'Router added to branch successfully',
      data: updatedBranch
    });
  } catch (error) {
    console.error('Error in addRouterToBranch controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getRouterById,
  addRouterToBranch
}; 