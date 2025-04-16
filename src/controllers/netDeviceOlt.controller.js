/**
 * Controller untuk endpoint net device OLT
 */

const routerRepository = require('../repositories/netDeviceRouter.repository');
const oltRepository = require('../repositories/netDeviceOlt.repository');

/**
 * Mendapatkan OLT berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOltById(req, res) {
  try {
    const { olt_id } = req.params;
    // Ambil parameter result dari query
    const { result } = req.query;
    
    // Validasi parameter result jika ada
    if (result && !Object.values(oltRepository.ResultTypes).includes(result)) {
      return res.status(400).json({
        error: 'Invalid result type',
        valid_values: Object.values(oltRepository.ResultTypes)
      });
    }
    
    const olt = await oltRepository.getOltDetailById(olt_id, result);
    
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