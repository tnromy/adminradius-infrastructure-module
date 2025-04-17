/**
 * Repository untuk operasi pada collection branches terkait net device router
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOltEntity } = require('../entities/netDeviceOlt.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');

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
 * Mendapatkan router berdasarkan ID
 * @param {string} routerId - ID router
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data router
 */
async function getRouterById(routerId, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    const branchCollection = getCollection('branches');
    const objectIdRouter = new ObjectId(routerId);
    
    // Gunakan pendekatan sederhana yang lebih andal
    // Ambil branch yang berisi router dengan ID yang sesuai
    const query = { 'children._id': objectIdRouter };
    
    const branches = await branchCollection.find(query).toArray();
    
    if (!branches || branches.length === 0) {
      return null;
    }
    
    // Ambil branch pertama yang memiliki router
    const branch = branches[0];
    let routerIndex = -1;
    let routerData = null;
    
    // Cari router dengan ID yang sesuai
    for (let i = 0; i < branch.children.length; i++) {
      if (branch.children[i]._id && branch.children[i]._id.toString() === objectIdRouter.toString()) {
        // Filter berdasarkan status deleted
        const hasDeletedAt = !!branch.children[i].deleted_at;
        
        if (
          (deletedFilter === DeletedFilterTypes.ONLY && !hasDeletedAt) ||
          (deletedFilter === DeletedFilterTypes.WITHOUT && hasDeletedAt)
        ) {
          continue; // Skip jika tidak sesuai filter
        }
        
        routerIndex = i;
        routerData = branch.children[i];
        break;
      }
    }
    
    if (!routerData) {
      return null;
    }
    
    // Tambahkan metadata yang dibutuhkan oleh fungsi soft delete
    routerData.branchId = branch._id;
    routerData.routerIndex = routerIndex;
    
    return routerData;
  } catch (error) {
    console.error('Error getting router by ID:', error);
    throw error;
  }
}

/**
 * Menambahkan OLT ke router berdasarkan ID router
 * @param {string} routerId - ID router
 * @param {Object} oltData - Data OLT yang akan ditambahkan
 * @returns {Promise<Object>} - Data branch yang sudah diupdate dengan OLT baru di router
 */
async function addOltToRouter(routerId, oltData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Jika ada available_pon, buat array pon_port
    if (oltData.available_pon && typeof oltData.available_pon === 'number') {
      const ponPorts = [];
      for (let i = 1; i <= oltData.available_pon; i++) {
        ponPorts.push({
          port: i,
          max_client: 64, // Nilai default untuk max_client
          children: []
        });
      }
      oltData.pon_port = ponPorts;
      // Hapus available_pon karena tidak diperlukan lagi
      delete oltData.available_pon;
    }
    
    // Buat entity OLT dengan ObjectId baru
    const oltId = new ObjectId();
    const olt = createNetDeviceOltEntity({
      ...oltData,
      _id: oltId
    });
    
    // Update branch, tambahkan OLT ke router.children
    const result = await collection.updateOne(
      { 'children._id': new ObjectId(routerId) },
      { 
        $push: { 'children.$.children': olt },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan router yang sudah diupdate
    return getRouterById(routerId, null);
  } catch (error) {
    console.error(`Error adding OLT to router with ID ${routerId}:`, error);
    throw error;
  }
}

module.exports = {
  getRouterById,
  addOltToRouter,
  ResultTypes
}; 