/**
 * Controller untuk endpoint net device ODC
 */

const oltRepository = require('../repositories/netDeviceOlt.repository');
const odcRepository = require('../repositories/netDeviceOdc.repository');

/**
 * Mendapatkan ODC berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOdcById(req, res) {
  try {
    const { odc_id } = req.params;
    // Ambil parameter result dari query
    const { result } = req.query;
    
    // Validasi parameter result jika ada
    if (result && !Object.values(odcRepository.ResultTypes).includes(result)) {
      return res.status(400).json({
        error: 'Invalid result type',
        valid_values: Object.values(odcRepository.ResultTypes)
      });
    }
    
    const odc = await odcRepository.getOdcDetailById(odc_id, result);
    
    if (!odc) {
      return res.status(404).json({
        error: 'ODC not found'
      });
    }
    
    res.status(200).json({
      data: odc
    });
  } catch (error) {
    console.error('Error in getOdcById controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Menambahkan ODC ke OLT pada port tertentu
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addOdcToOlt(req, res) {
  try {
    const { olt_id } = req.params;
    
    // Periksa apakah OLT ada
    const oltInfo = await oltRepository.getOltById(olt_id);
    if (!oltInfo || !oltInfo.olt) {
      return res.status(404).json({
        error: 'OLT not found'
      });
    }
    
    // Periksa apakah port yang dimaksud ada di OLT
    const ponPort = oltInfo.olt.pon_port.find(port => port.port === req.body.pon_port);
    if (!ponPort) {
      return res.status(404).json({
        error: `Port ${req.body.pon_port} not found on OLT`
      });
    }
    
    // Tambahkan ODC ke OLT pada port tertentu
    const updatedOltInfo = await oltRepository.addOdcToOlt(olt_id, req.body);
    
    res.status(200).json({
      message: 'ODC added to OLT successfully',
      data: updatedOltInfo.olt
    });
  } catch (error) {
    console.error('Error in addOdcToOlt controller:', error);
    
    // Handling specific errors
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getOdcById,
  addOdcToOlt
}; 