/**
 * Repository untuk operasi pada collection branches terkait net device router
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOltEntity } = require('../entities/netDeviceOlt.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Nama collection
const COLLECTION = 'branches';

/**
 * Mendapatkan router berdasarkan ID
 * @param {string} routerId - ID router
 * @returns {Promise<Object>} - Data router
 */
async function getRouterById(routerId) {
  try {
    const collection = getCollection(COLLECTION);
    // Mencari branch yang memiliki router dengan ID tertentu di dalam children
    const branch = await collection.findOne({
      'children._id': new ObjectId(routerId)
    });
    
    if (!branch) {
      return null;
    }
    
    // Cari router dalam array children
    const router = branch.children.find(child => 
      child._id.toString() === routerId && child.type === 'router'
    );
    
    return router || null;
  } catch (error) {
    console.error(`Error getting router with ID ${routerId}:`, error);
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
    return getRouterById(routerId);
  } catch (error) {
    console.error(`Error adding OLT to router with ID ${routerId}:`, error);
    throw error;
  }
}

module.exports = {
  getRouterById,
  addOltToRouter
}; 