/**
 * Controller untuk endpoint net device ODC
 */

const oltRepository = require('../repositories/netDeviceOlt.repository');
const odcRepository = require('../repositories/netDeviceOdc.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes
const { softDeleteOdc } = require('../utils/recursiveSoftDelete.util');

/**
 * Mendapatkan ODC berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getOdcById(req, res) {
  try {
    const { odc_id } = req.params;
    // Ambil parameter dari query
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const odc = await odcRepository.getOdcById(odc_id, deletedFilter);
    
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

/**
 * Melakukan soft delete pada ODC dan semua ODP serta ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOdc(req, res) {
  try {
    const { odc_id } = req.params;
    
    // Periksa apakah ODC ada
    const odcInfo = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.WITHOUT);
    if (!odcInfo || !odcInfo.odc) {
      return res.status(404).json({
        error: 'ODC not found or already deleted'
      });
    }
    
    // Lakukan soft delete rekursif pada ODC dan semua ODP serta ONT di dalamnya
    const result = await softDeleteOdc({
      branchId: odcInfo.branchId,
      routerIndex: odcInfo.routerIndex,
      oltIndex: odcInfo.oltIndex,
      ponPortIndex: odcInfo.ponPortIndex,
      odcIndex: odcInfo.odcIndex
    });
    
    if (!result) {
      return res.status(500).json({
        error: 'Failed to delete ODC'
      });
    }
    
    // Dapatkan ODC yang sudah di-soft delete
    const deletedOdc = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.WITH);
    
    // Sukses, kembalikan status 200 dengan data ODC yang sudah di-soft delete
    res.status(200).json({
      message: 'ODC and all ODPs and ONTs deleted successfully',
      data: deletedOdc.odc
    });
  } catch (error) {
    console.error('Error in deleteOdc controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Melakukan restore pada ODC yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreOdc(req, res) {
  try {
    const { odc_id } = req.params;
    console.log(`[restoreOdc] Mencoba restore ODC dengan ID: ${odc_id}`);
    
    // Periksa status ODC terlebih dahulu - gunakan filter ONLY untuk mencari yang sudah dihapus
    const odcInfo = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.ONLY);
    console.log(`[restoreOdc] Status pencarian ODC yang dihapus:`, odcInfo);
    
    if (!odcInfo || !odcInfo.odc) {
      console.log(`[restoreOdc] ODC dengan ID ${odc_id} tidak ditemukan atau sudah di-restore`);
      return res.status(404).json({
        error: 'ODC not found or already restored'
      });
    }
    
    // Coba restore ODC
    console.log(`[restoreOdc] Mencoba melakukan restore ODC`);
    const result = await odcRepository.restore(odc_id);
    console.log(`[restoreOdc] Hasil restore:`, result);
    
    if (!result) {
      console.log(`[restoreOdc] Gagal melakukan restore ODC`);
      return res.status(404).json({
        error: 'Failed to restore ODC'
      });
    }
    
    // Dapatkan data ODC yang sudah di-restore menggunakan filter WITH untuk memastikan kita bisa menemukannya
    console.log(`[restoreOdc] Mengambil data ODC yang sudah di-restore`);
    const restoredOdc = await odcRepository.getOdcById(odc_id, branchRepository.DeletedFilterTypes.WITH);
    console.log(`[restoreOdc] Data ODC yang sudah di-restore:`, restoredOdc);
    
    res.status(200).json({
      message: 'ODC restored successfully',
      data: restoredOdc
    });
  } catch (error) {
    console.error('Error in restoreOdc controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getOdcById,
  addOdcToOlt,
  deleteOdc,
  restoreOdc
}; 