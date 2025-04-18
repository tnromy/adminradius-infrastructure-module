/**
 * Repository untuk operasi pada collection branches terkait net device ONT
 */

const { getCollection } = require('./database.connector');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');
const { recursiveDeletedCheck } = require('../utils/recursiveDeletedCheck.util');

// Nama collection
const COLLECTION = 'branches';

/**
 * Mendapatkan ONT berdasarkan ID
 * @param {string} ontId - ID ONT
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object|null>} ONT yang ditemukan atau null
 */
async function getOntById(ontId, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    console.log(`[getOntById] Mencari ONT dengan ID: ${ontId}, filter: ${deletedFilter}`);
    
    const collection = getCollection(COLLECTION);
    
    // Cari branch yang memiliki ONT dengan ID yang sesuai
    const query = {
      $or: [
        { 'children.children.pon_port.children.trays.children.children.children._id': new ObjectId(ontId) },
        { 'children.children.pon_port.children.trays.children.children._id': new ObjectId(ontId) }
      ]
    };
    
    console.log('[getOntById] Query MongoDB:', JSON.stringify(query, null, 2));
    
    const branch = await collection.findOne(query);
    
    console.log(`[getOntById] Branch ditemukan: ${branch ? 'Ya' : 'Tidak'}`);
    
    if (!branch) return null;

    // Cari ONT dalam struktur nested
    let foundOnt = null;
    const searchOnt = (obj) => {
      // Log untuk debugging
      if (obj._id) {
        console.log(`[searchOnt] Memeriksa object dengan ID: ${obj._id.toString()}`);
      }
      
      if (obj._id && obj._id.toString() === ontId.toString()) {
        console.log('[searchOnt] ONT ditemukan!');
        foundOnt = { ...obj };
        return;
      }
      
      // Cek children
      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach(child => searchOnt(child));
      }
      
      // Cek pon_port dan children-nya
      if (obj.pon_port && Array.isArray(obj.pon_port)) {
        obj.pon_port.forEach(port => {
          if (port.children) {
            port.children.forEach(child => searchOnt(child));
          }
        });
      }
      
      // Cek trays dan children-nya
      if (obj.trays && Array.isArray(obj.trays)) {
        obj.trays.forEach(tray => {
          if (tray.children) {
            tray.children.forEach(child => searchOnt(child));
          }
        });
      }
    };

    searchOnt(branch);
    
    console.log(`[getOntById] ONT ditemukan setelah pencarian: ${foundOnt ? 'Ya' : 'Tidak'}`);
    
    // Jika ONT tidak ditemukan
    if (!foundOnt) {
      console.log('[getOntById] ONT tidak ditemukan setelah pencarian mendalam');
      return null;
    }

    // Log status deleted
    console.log(`[getOntById] Status deleted_at ONT: ${foundOnt.deleted_at ? 'Ada' : 'Tidak ada'}`);
    
    // Terapkan filter deleted
    if (deletedFilter === DeletedFilterTypes.ONLY && !foundOnt.deleted_at) {
      console.log('[getOntById] ONT tidak memiliki deleted_at, tapi filter ONLY');
      return null;
    }
    if (deletedFilter === DeletedFilterTypes.WITHOUT && foundOnt.deleted_at) {
      console.log('[getOntById] ONT memiliki deleted_at, tapi filter WITHOUT');
      return null;
    }
    
    console.log('[getOntById] ONT berhasil ditemukan dan memenuhi filter');
    return foundOnt;
  } catch (error) {
    console.error('Error getting ONT by ID:', error);
    throw error;
  }
}

/**
 * Melakukan soft delete pada ONT berdasarkan ID
 * @param {string} ontId - ID ONT
 * @returns {Promise<Object>} - ONT yang sudah di-soft delete
 */
async function softDeleteOnt(ontId) {
  try {
    console.log(`[softDeleteOnt] Mencoba soft delete ONT dengan ID: ${ontId}`);
    
    // Dapatkan informasi ONT
    const ont = await getOntById(ontId, DeletedFilterTypes.WITHOUT);
    if (!ont) {
      console.log('[softDeleteOnt] ONT tidak ditemukan atau sudah dihapus');
      return null;
    }

    const collection = getCollection(COLLECTION);
    
    // Update ONT menggunakan array filters
    const result = await collection.updateOne(
      {
        $or: [
          { 'children.children.pon_port.children.trays.children.children.children._id': new ObjectId(ontId) },
          { 'children.children.pon_port.children.trays.children.children._id': new ObjectId(ontId) }
        ]
      },
      {
        $set: {
          'children.$[].children.$[].pon_port.$[].children.$[].trays.$[].children.$[].children.$[ont].deleted_at': new Date(),
          updatedAt: new Date()
        }
      },
      {
        arrayFilters: [
          { 'ont._id': new ObjectId(ontId) }
        ]
      }
    );

    console.log(`[softDeleteOnt] Update result: matchedCount=${result.matchedCount}, modifiedCount=${result.modifiedCount}`);
    
    if (result.modifiedCount === 0) {
      console.log('[softDeleteOnt] Gagal melakukan soft delete ONT');
      return null;
    }

    // Dapatkan ONT yang sudah diupdate (dengan WITH filter karena sudah di-soft delete)
    const updatedOnt = await getOntById(ontId, DeletedFilterTypes.WITH);
    console.log('[softDeleteOnt] ONT berhasil di-soft delete');
    
    return updatedOnt;
  } catch (error) {
    console.error('Error soft deleting ONT:', error);
    throw error;
  }
}

/**
 * Melakukan restore pada ONT yang sudah di-soft delete
 * @param {string} ontId - ID ONT yang akan di-restore
 * @returns {Promise<Object|null>} ONT yang sudah di-restore atau null jika tidak ditemukan
 */
async function restoreOnt(ontId) {
  try {
    console.log(`[restoreOnt] Mencoba restore ONT dengan ID: ${ontId}`);
    
    const collection = getCollection(COLLECTION);
    
    // Cari ONT yang memiliki deleted_at
    const ont = await getOntById(ontId, DeletedFilterTypes.ONLY);
    console.log(`[restoreOnt] ONT ditemukan dengan filter ONLY: ${ont ? 'Ya' : 'Tidak'}`);
    
    if (!ont) {
      console.log('[restoreOnt] ONT tidak ditemukan atau sudah di-restore');
      return null;
    }

    // Update ONT dengan menghapus field deleted_at menggunakan array filters
    const result = await collection.updateOne(
      {
        $or: [
          { 'children.children.pon_port.children.trays.children.children.children._id': new ObjectId(ontId) },
          { 'children.children.pon_port.children.trays.children.children._id': new ObjectId(ontId) }
        ]
      },
      {
        $unset: {
          'children.$[].children.$[].pon_port.$[].children.$[].trays.$[].children.$[].children.$[ont].deleted_at': ""
        },
        $set: {
          updatedAt: new Date()
        }
      },
      {
        arrayFilters: [
          { 'ont._id': new ObjectId(ontId) }
        ]
      }
    );

    console.log(`[restoreOnt] Update result: matchedCount=${result.matchedCount}, modifiedCount=${result.modifiedCount}`);

    if (result.modifiedCount === 0) {
      console.log('[restoreOnt] Gagal melakukan restore ONT');
      return null;
    }

    // Ambil data ONT yang sudah di-restore
    const restoredOnt = await getOntById(ontId, DeletedFilterTypes.WITHOUT);
    console.log('[restoreOnt] ONT berhasil di-restore');
    
    return restoredOnt;
  } catch (error) {
    console.error('Error restoring ONT:', error);
    throw error;
  }
}

module.exports = {
  getOntById,
  softDeleteOnt,
  restoreOnt
}; 