/**
 * Controller untuk endpoint net device OLT
 */

const routerRepository = require('../repositories/netDeviceRouter.repository');
const oltRepository = require('../repositories/netDeviceOlt.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes

/**
 * Mendapatkan OLT berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOltById(req, res) {
  try {
    const { olt_id } = req.params;
    // Ambil parameter dari query
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const olt = await oltRepository.getOltById(olt_id, deletedFilter);
    
    if (!olt) {
      return res.status(404).json({
        error: 'OLT not found'
      });
    }
    
    res.status(200).json({
      data: olt
    });
  } catch (error) {
    console.error('Error in getOltById controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Menambahkan OLT ke router
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOltToRouter(req, res) {
  try {
    const { router_id } = req.params;
    
    // Periksa apakah router ada
    const router = await routerRepository.getRouterById(router_id);
    if (!router) {
      return res.status(404).json({
        error: 'Router not found'
      });
    }
    
    // Tambahkan OLT ke router
    const updatedRouter = await routerRepository.addOltToRouter(router_id, req.body);
    
    res.status(200).json({
      message: 'OLT added to router successfully',
      data: updatedRouter
    });
  } catch (error) {
    console.error('Error in addOltToRouter controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getOltById,
  addOltToRouter
}; 