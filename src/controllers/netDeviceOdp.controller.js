/**
 * Controller untuk endpoint net device ODP
 */

const odcRepository = require('../repositories/netDeviceOdc.repository');
const odpRepository = require('../repositories/netDeviceOdp.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes

/**
 * Mendapatkan ODP berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOdpById(req, res) {
  try {
    const { odp_id } = req.params;
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const odp = await odpRepository.getOdpById(odp_id, deletedFilter);
    
    if (!odp) {
      return res.status(404).json({
        error: 'ODP not found'
      });
    }
    
    res.status(200).json({
      data: odp
    });
  } catch (error) {
    console.error('Error in getOdpById controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Menambahkan ODP ke ODC pada tray tertentu
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOdpToOdc(req, res) {
  try {
    const { odc_id } = req.params;
    
    // Periksa apakah ODC ada
    const odcInfo = await odcRepository.getOdcById(odc_id);
    if (!odcInfo || !odcInfo.odc) {
      return res.status(404).json({
        error: 'ODC not found'
      });
    }
    
    // Periksa apakah tray yang dimaksud ada di ODC
    const tray = odcInfo.odc.trays.find(tray => tray.tray === req.body.tray);
    if (!tray) {
      return res.status(404).json({
        error: `Tray ${req.body.tray} not found on ODC`
      });
    }
    
    // Validasi core_on_odc_tray
    if (req.body.core_on_odc_tray < tray.start_core || req.body.core_on_odc_tray > tray.end_core) {
      return res.status(400).json({
        error: `core_on_odc_tray value (${req.body.core_on_odc_tray}) out of range for tray ${req.body.tray}. Valid range: ${tray.start_core}-${tray.end_core}`
      });
    }
    
    // Tambahkan ODP ke ODC pada tray tertentu
    const updatedOdcInfo = await odcRepository.addOdpToOdc(odc_id, req.body);
    
    res.status(200).json({
      message: 'ODP added to ODC successfully',
      data: updatedOdcInfo.odc
    });
  } catch (error) {
    console.error('Error in addOdpToOdc controller:', error);
    
    // Handling specific errors
    if (error.message && (error.message.includes('not found') || error.message.includes('out of range'))) {
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
  getOdpById,
  addOdpToOdc
}; 