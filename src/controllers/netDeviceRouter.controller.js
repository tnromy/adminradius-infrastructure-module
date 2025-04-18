/**
 * Controller untuk endpoint net device router
 */

const branchRepository = require('../repositories/branch.repository');
const routerRepository = require('../repositories/netDeviceRouter.repository');
const { softDeleteRouter } = require('../utils/recursiveSoftDelete.util');

/**
 * Mendapatkan router berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getRouterById(req, res) {
  try {
    const { router_id } = req.params;
    const { deleted } = req.query;
    
    // Tentukan filter deleted (defaultnya WITHOUT)
    let deletedFilter = branchRepository.DeletedFilterTypes.WITHOUT;
    if (deleted && Object.values(branchRepository.DeletedFilterTypes).includes(deleted)) {
      deletedFilter = deleted;
    }
    
    const router = await routerRepository.getRouterById(router_id, deletedFilter);
    
    if (!router) {
      return res.status(404).json({
        error: 'Router not found'
      });
    }
    
    res.status(200).json({
      data: router
    });
  } catch (error) {
    console.error('Error in getRouterById controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Menambahkan router ke branch
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function addRouterToBranch(req, res) {
  try {
    const { branch_id } = req.params;
    
    // Periksa apakah branch ada
    const branch = await branchRepository.getBranchById(branch_id);
    if (!branch) {
      return res.status(404).json({
        error: 'Branch not found'
      });
    }
    
    // Tambahkan router ke branch
    const updatedBranch = await branchRepository.addRouterToBranch(branch_id, req.body);
    
    res.status(200).json({
      message: 'Router added to branch successfully',
      data: updatedBranch
    });
  } catch (error) {
    console.error('Error in addRouterToBranch controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Melakukan soft delete pada Router dan semua OLT, ODC, ODP, serta ONT di dalamnya
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function deleteRouter(req, res) {
  try {
    const { router_id } = req.params;
    console.log(`[deleteRouter] Mencoba delete Router dengan ID: ${router_id}`);
    
    // Periksa apakah Router ada
    const routerInfo = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.WITHOUT);
    if (!routerInfo || !routerInfo.router) {
      console.log('[deleteRouter] Router tidak ditemukan atau sudah dihapus');
      return res.status(404).json({
        error: 'Router not found or already deleted'
      });
    }
    
    // Lakukan soft delete rekursif pada Router dan semua device di dalamnya
    try {
      console.log('[deleteRouter] Memulai proses soft delete');
      const result = await softDeleteRouter({
        branchId: routerInfo.branchId,
        routerIndex: routerInfo.routerIndex
      });
      
      if (!result) {
        console.error('[deleteRouter] Soft delete gagal');
        return res.status(500).json({
          error: 'Failed to delete Router'
        });
      }
      
      console.log('[deleteRouter] Soft delete berhasil, mengambil data Router yang sudah dihapus');
      // Dapatkan Router yang sudah di-soft delete
      const deletedRouter = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.WITH);
      
      // Sukses, kembalikan status 200 dengan data Router yang sudah di-soft delete
      res.status(200).json({
        message: 'Router and all OLTs, ODCs, ODPs, and ONTs deleted successfully',
        data: deletedRouter?.router || { _id: router_id, deleted_at: new Date() }
      });
    } catch (deleteError) {
      console.error('[deleteRouter] Error saat proses delete:', deleteError);
      return res.status(500).json({
        error: `Failed to delete Router: ${deleteError.message || 'Unknown error'}`
      });
    }
  } catch (error) {
    console.error('[deleteRouter] Error di controller:', error);
    res.status(500).json({
      error: `Internal server error: ${error.message || 'Unknown error'}`
    });
  }
}

/**
 * Melakukan restore pada Router yang sudah di-soft delete
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function restoreRouter(req, res) {
  try {
    const { router_id } = req.params;
    console.log(`[restoreRouter] Mencoba restore Router dengan ID: ${router_id}`);
    
    // Periksa status Router terlebih dahulu
    const routerInfo = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.ONLY);
    console.log(`[restoreRouter] Status pencarian Router yang dihapus:`, routerInfo);
    
    if (!routerInfo || !routerInfo.router) {
      console.log(`[restoreRouter] Router dengan ID ${router_id} tidak ditemukan atau sudah di-restore`);
      return res.status(404).json({
        error: 'Router not found or already restored'
      });
    }
    
    // Coba restore Router
    console.log(`[restoreRouter] Mencoba melakukan restore Router`);
    const result = await routerRepository.restore(router_id);
    console.log(`[restoreRouter] Hasil restore:`, result);
    
    if (!result) {
      console.log(`[restoreRouter] Gagal melakukan restore Router`);
      return res.status(404).json({
        error: 'Failed to restore Router'
      });
    }
    
    // Dapatkan data Router yang sudah di-restore
    console.log(`[restoreRouter] Mengambil data Router yang sudah di-restore`);
    const restoredRouter = await routerRepository.getRouterById(router_id, branchRepository.DeletedFilterTypes.WITH);
    console.log(`[restoreRouter] Data Router yang sudah di-restore:`, restoredRouter);
    
    res.status(200).json({
      message: 'Router restored successfully',
      data: restoredRouter
    });
  } catch (error) {
    console.error('Error in restoreRouter controller:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getRouterById,
  addRouterToBranch,
  deleteRouter,
  restoreRouter
}; 