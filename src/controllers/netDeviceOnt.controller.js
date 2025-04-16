/**
 * Controller untuk endpoint net device ONT
 */

const odpRepository = require('../repositories/netDeviceOdp.repository');

/**
 * Menambahkan ONT ke ODP
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOntToOdp(req, res) {
  try {
    const { odp_id } = req.params;
    
    // Periksa apakah ODP ada
    const odpInfo = await odpRepository.getOdpById(odp_id);
    if (!odpInfo || !odpInfo.odp) {
      return res.status(404).json({
        error: 'ODP not found'
      });
    }
    
    // Periksa kapasitas port ODP
    const maxAvailablePort = odpInfo.odp.available_port || 0;
    const currentOntCount = odpInfo.odp.children ? odpInfo.odp.children.length : 0;
    
    if (currentOntCount >= maxAvailablePort) {
      return res.status(400).json({
        error: `ODP port capacity exceeded. Maximum port: ${maxAvailablePort}, current ONT count: ${currentOntCount}`
      });
    }
    
    // Tambahkan ONT ke ODP
    const updatedOdpInfo = await odpRepository.addOntToOdp(odp_id, req.body);
    
    res.status(200).json({
      message: 'ONT added to ODP successfully',
      data: updatedOdpInfo.odp
    });
  } catch (error) {
    console.error('Error in addOntToOdp controller:', error);
    
    // Handling specific errors
    if (error.message && (error.message.includes('not found') || error.message.includes('exceeded'))) {
      return res.status(400).json({
        error: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  addOntToOdp
}; 