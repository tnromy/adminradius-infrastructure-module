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
    
    // Pipeline aggregation untuk mencari router berdasarkan ID
    const pipeline = [
      // Unwind array children (router)
      { $unwind: { path: '$children', preserveNullAndEmptyArrays: true } },
      
      // Match router_id yang diinginkan
      { $match: { 'children._id': new ObjectId(routerId) } },
      
      // Project hanya data router
      { $project: { router: '$children', _id: 0 } }
    ];
    
    // Tambahkan filter deleted
    if (deletedFilter === DeletedFilterTypes.ONLY) {
      pipeline[1].$match['children.deleted_at'] = { $exists: true };
    } else if (deletedFilter === DeletedFilterTypes.WITHOUT) {
      pipeline[1].$match['children.deleted_at'] = { $exists: false };
    }
    // Jika WITH, tidak perlu filter tambahan
    
    const result = await branchCollection.aggregate(pipeline).toArray();
    
    if (!result || result.length === 0 || !result[0].router) {
      return null;
    }
    
    return result[0].router;
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