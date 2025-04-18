/**
 * Controller untuk endpoint net device OLT
 */

const routerRepository = require('../repositories/netDeviceRouter.repository');
const oltRepository = require('../repositories/netDeviceOlt.repository');
const branchRepository = require('../repositories/branch.repository'); // Untuk DeletedFilterTypes
const { softDeleteOlt } = require('../utils/recursiveSoftDelete.util');

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

/**
 * Melakukan soft delete pada OLT dan semua ODC, ODP, serta ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteOlt(req, res) {
  try {
    const { olt_id } = req.params;
    console.log(`[deleteOlt] Mencoba delete OLT dengan ID: ${olt_id}`);
    
    // Periksa apakah OLT ada
    const oltInfo = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.WITHOUT);
    if (!oltInfo || !oltInfo.olt) {
      console.log('[deleteOlt] OLT tidak ditemukan atau sudah dihapus');
      return res.status(404).json({
        error: 'OLT not found or already deleted'
      });
    }
    
    // Lakukan soft delete rekursif pada OLT dan semua ODC, ODP, serta ONT di dalamnya
    try {
      console.log('[deleteOlt] Memulai proses soft delete');
      const result = await softDeleteOlt({
        branchId: oltInfo.branchId,
        routerIndex: oltInfo.routerIndex,
        oltIndex: oltInfo.oltIndex
      });
      
      // Periksa hasil soft delete (result adalah boolean)
      if (!result) {
        console.error('[deleteOlt] Soft delete gagal');
        return res.status(500).json({
          error: 'Failed to delete OLT'
        });
      }
      
      console.log('[deleteOlt] Soft delete berhasil, mengambil data OLT yang sudah dihapus');
      // Dapatkan OLT yang sudah di-soft delete
      const deletedOlt = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.WITH);
      
      // Sukses, kembalikan status 200 dengan data OLT yang sudah di-soft delete
      res.status(200).json({
        message: 'OLT and all ODCs, ODPs, and ONTs deleted successfully',
        data: deletedOlt?.olt || { _id: olt_id, deleted_at: new Date() }
      });
    } catch (deleteError) {
      console.error('[deleteOlt] Error saat proses delete:', deleteError);
      return res.status(500).json({
        error: `Failed to delete OLT: ${deleteError.message || 'Unknown error'}`
      });
    }
  } catch (error) {
    console.error('[deleteOlt] Error di controller:', error);
    res.status(500).json({
      error: `Internal server error: ${error.message || 'Unknown error'}`
    });
  }
}

/**
 * Melakukan restore pada OLT yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreOlt(req, res) {
  try {
    const { olt_id } = req.params;
    console.log(`[restoreOlt] Mencoba restore OLT dengan ID: ${olt_id}`);
    
    // Periksa status OLT terlebih dahulu - gunakan filter ONLY untuk mencari yang sudah dihapus
    const oltInfo = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.ONLY);
    console.log(`[restoreOlt] Status pencarian OLT yang dihapus:`, oltInfo);
    
    if (!oltInfo || !oltInfo.olt) {
      console.log(`[restoreOlt] OLT dengan ID ${olt_id} tidak ditemukan atau sudah di-restore`);
      return res.status(404).json({
        error: 'OLT not found or already restored'
      });
    }
    
    // Coba restore OLT
    console.log(`[restoreOlt] Mencoba melakukan restore OLT`);
    const result = await oltRepository.restore(olt_id);
    console.log(`[restoreOlt] Hasil restore:`, result);
    
    if (!result) {
      console.log(`[restoreOlt] Gagal melakukan restore OLT`);
      return res.status(404).json({
        error: 'Failed to restore OLT'
      });
    }
    
    // Dapatkan data OLT yang sudah di-restore menggunakan filter WITH untuk memastikan kita bisa menemukannya
    console.log(`[restoreOlt] Mengambil data OLT yang sudah di-restore`);
    const restoredOlt = await oltRepository.getOltById(olt_id, branchRepository.DeletedFilterTypes.WITH);
    console.log(`[restoreOlt] Data OLT yang sudah di-restore:`, restoredOlt);
    
    res.status(200).json({
      message: 'OLT restored successfully',
      data: restoredOlt
    });
  } catch (error) {
    console.error('Error in restoreOlt controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getOltById,
  addOltToRouter,
  deleteOlt,
  restoreOlt
}; 