/**
 * Controller untuk endpoint net device ODP
 */

const odcRepository = require('../repositories/netDeviceOdc.repository');
const odpRepository = require('../repositories/netDeviceOdp.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes
const { softDeleteOdp } = require('../utils/recursiveSoftDelete.util');

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

/**
 * Melakukan soft delete pada ODP dan semua ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOdp(req, res) {
  try {
    const { odp_id } = req.params;
    
    // Periksa apakah ODP ada
    const odpInfo = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.WITHOUT);
    if (!odpInfo || !odpInfo.odp) {
      return res.status(404).json({
        error: 'ODP not found or already deleted'
      });
    }
    
    // Lakukan soft delete rekursif pada ODP dan semua ONT di dalamnya
    const result = await softDeleteOdp({
      branchId: odpInfo.branchId,
      routerIndex: odpInfo.routerIndex,
      oltIndex: odpInfo.oltIndex,
      ponPortIndex: odpInfo.ponPortIndex,
      odcIndex: odpInfo.odcIndex,
      trayIndex: odpInfo.trayIndex,
      odpIndex: odpInfo.odpIndex
    });
    
    if (!result) {
      return res.status(500).json({
        error: 'Failed to delete ODP'
      });
    }
    
    // Dapatkan ODP yang sudah di-soft delete
    const deletedOdp = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.WITH);
    
    // Sukses, kembalikan status 200 dengan data ODP yang sudah di-soft delete
    res.status(200).json({
      message: 'ODP and all ONTs deleted successfully',
      data: deletedOdp.odp
    });
  } catch (error) {
    console.error('Error in deleteOdp controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Melakukan restore pada ODP yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreOdp(req, res) {
  try {
    const { odp_id } = req.params;
    console.log(`[restoreOdp] Mencoba restore ODP dengan ID: ${odp_id}`);
    
    // Periksa status ODP terlebih dahulu
    const odpInfo = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.ONLY);
    console.log(`[restoreOdp] Status pencarian ODP yang dihapus:`, odpInfo);
    
    if (!odpInfo || !odpInfo.odp) {
      console.log(`[restoreOdp] ODP dengan ID ${odp_id} tidak ditemukan atau sudah di-restore`);
      return res.status(404).json({
        error: 'ODP not found or already restored'
      });
    }
    
    // Coba restore ODP
    console.log(`[restoreOdp] Mencoba melakukan restore ODP`);
    const result = await odpRepository.restore(odp_id);
    console.log(`[restoreOdp] Hasil restore:`, result);
    
    if (!result) {
      console.log(`[restoreOdp] Gagal melakukan restore ODP`);
      return res.status(404).json({
        error: 'Failed to restore ODP'
      });
    }
    
    // Dapatkan data ODP yang sudah di-restore
    console.log(`[restoreOdp] Mengambil data ODP yang sudah di-restore`);
    const restoredOdp = await odpRepository.getOdpById(odp_id, branchRepository.DeletedFilterTypes.WITHOUT);
    console.log(`[restoreOdp] Data ODP yang sudah di-restore:`, restoredOdp);
    
    res.status(200).json({
      message: 'ODP restored successfully',
      data: restoredOdp
    });
  } catch (error) {
    console.error('Error in restoreOdp controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getOdpById,
  addOdpToOdc,
  deleteOdp,
  restoreOdp
}; 