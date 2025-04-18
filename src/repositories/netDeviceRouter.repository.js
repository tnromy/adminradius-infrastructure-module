/**
 * Repository untuk operasi pada collection branches terkait net device router
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOltEntity } = require('../entities/netDeviceOlt.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');
const { restoreRouter } = require('../utils/recursiveRestore.util');

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe result
const ResultTypes = {
  ROUTERS: 'ROUTERS',
  OLTS: 'OLTS',
  ODCS: 'ODCS',
  ODPS: 'ODPS'
};

/**
 * Mendapatkan Router berdasarkan ID
 * @param {string} routerId - ID Router
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data Router
 */
async function getRouterById(routerId, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    console.log(`[getRouterById] Mencari Router dengan ID: ${routerId}, filter: ${deletedFilter}`);
    const collection = getCollection(COLLECTION);
    const objectId = new ObjectId(routerId);
    
    // Cari branch yang memiliki Router dengan ID tertentu
    const branch = await collection.findOne({
      'children._id': objectId
    });
    
    console.log(`[getRouterById] Branch ditemukan: ${branch ? 'Ya' : 'Tidak'}`);
    
    if (!branch) return null;
    
    // Variabel untuk menyimpan indeks dan data
    let routerIndex = -1;
    let routerData = null;
    
    // Loop melalui branch > router
    for (let i = 0; i < branch.children.length; i++) {
      const router = branch.children[i];
      
      if (router._id.toString() === routerId.toString()) {
        console.log(`[getRouterById] Router ditemukan dengan deleted_at: ${router.deleted_at || 'tidak ada'}`);
        
        // Periksa filter
        if (deletedFilter === DeletedFilterTypes.ONLY && !router.deleted_at) {
          console.log('[getRouterById] Router tidak memiliki deleted_at, tapi filter ONLY');
          continue;
        }
        if (deletedFilter === DeletedFilterTypes.WITHOUT && router.deleted_at) {
          console.log('[getRouterById] Router memiliki deleted_at, tapi filter WITHOUT');
          continue;
        }
        
        routerIndex = i;
        routerData = router;
        break;
      }
    }
    
    // Jika Router tidak ditemukan atau tidak memenuhi filter
    if (!routerData) {
      console.log('[getRouterById] Router tidak ditemukan atau tidak memenuhi filter');
      return null;
    }
    
    console.log('[getRouterById] Router berhasil ditemukan dan memenuhi filter');
    
    // Return objek dengan data Router dan indeksnya
    return {
      router: routerData,
      branchId: branch._id,
      routerIndex
    };
  } catch (error) {
    console.error('Error getting Router by ID:', error);
    throw error;
  }
}

/**
 * Menambahkan OLT ke Router
 * @param {string} routerId - ID Router
 * @param {Object} oltData - Data OLT yang akan ditambahkan
 * @returns {Promise<Object>} - Data Router yang sudah diupdate dengan OLT baru
 */
async function addOltToRouter(routerId, oltData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Dapatkan informasi Router
    const routerInfo = await getRouterById(routerId);
    if (!routerInfo || !routerInfo.router) {
      return null;
    }
    
    const { router, branchId, routerIndex } = routerInfo;
    
    // Buat entity OLT dengan ObjectId baru
    const oltId = new ObjectId();
    const olt = createNetDeviceOltEntity({
      ...oltData,
      _id: oltId
    });
    
    // Update branch, tambahkan OLT ke Router
    const result = await collection.updateOne(
      { _id: branchId },
      { 
        $push: { [`children.${routerIndex}.children`]: olt },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan Router yang sudah diupdate
    return getRouterById(routerId);
  } catch (error) {
    console.error(`Error adding OLT to Router with ID ${routerId}:`, error);
    throw error;
  }
}

/**
 * Melakukan restore pada Router yang telah di-soft delete
 * @param {string} routerId - ID Router yang akan di-restore
 * @returns {Promise<Object|null>} - Hasil restore atau null jika Router tidak ditemukan/tidak bisa di-restore
 */
async function restore(routerId) {
  try {
    console.log(`[restore] Mencoba restore Router dengan ID: ${routerId}`);
    
    // Cari Router yang memiliki deleted_at
    const routerInfo = await getRouterById(routerId, DeletedFilterTypes.ONLY);
    console.log(`[restore] Status pencarian Router yang dihapus:`, routerInfo);
    
    if (!routerInfo || !routerInfo.router) {
      console.log('[restore] Router tidak ditemukan atau sudah di-restore');
      return null;
    }
    
    // Lakukan restore
    console.log('[restore] Memanggil fungsi restoreRouter');
    const result = await restoreRouter(routerId);
    console.log(`[restore] Hasil restore:`, result);
    
    return result;
  } catch (error) {
    console.error('Error in Router repository - restore:', error);
    throw error;
  }
}

module.exports = {
  getRouterById,
  addOltToRouter,
  restore,
  ResultTypes
}; 