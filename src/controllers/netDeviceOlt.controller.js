/**
 * Controller untuk endpoint net device OLT
 */

const routerRepository = require('../repositories/netDeviceRouter.repository');

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
  addOltToRouter
}; 