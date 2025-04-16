/**
 * Controller untuk endpoint net device ONT
 */

const odpRepository = require('../repositories/netDeviceOdp.repository');
const ontRepository = require('../repositories/netDeviceOnt.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes

/**
 * Mendapatkan ONT berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOntById(req, res) {
  try {
    const { ont_id } = req.params;
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const ont = await ontRepository.getOntById(ont_id, deletedFilter);
    
    if (!ont) {
      return res.status(404).json({
        error: 'ONT not found'
      });
    }
    
    res.status(200).json({
      data: ont
    });
  } catch (error) {
    console.error('Error in getOntById controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Melakukan soft delete pada ONT berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOnt(req, res) {
  try {
    const { ont_id } = req.params;
    
    // Periksa apakah ONT ada
    const ont = await ontRepository.getOntById(ont_id, branchRepository.DeletedFilterTypes.WITHOUT);
    if (!ont) {
      return res.status(404).json({
        error: 'ONT not found or already deleted'
      });
    }
    
    // Lakukan soft delete
    const deletedOnt = await ontRepository.softDeleteOnt(ont_id);
    
    if (!deletedOnt) {
      return res.status(500).json({
        error: 'Failed to delete ONT'
      });
    }
    
    // Sukses, kembalikan status 200 dengan data ONT yang sudah di-soft delete
    res.status(200).json({
      message: 'ONT deleted successfully',
      data: deletedOnt
    });
  } catch (error) {
    console.error('Error in deleteOnt controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

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
  getOntById,
  addOntToOdp,
  deleteOnt
}; 