/**
 * Repository untuk operasi CRUD pada collection branches
 */

const { getCollection } = require('./database.connector');
const { createBranchEntity } = require('../entities/branch.entity');
const { createNetDeviceRouterEntity } = require('../entities/netDeviceRouter.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { recursiveDeletedCheck, DeletedFilterTypes } = require('../utils/recursiveDeletedCheck.util');
const { logDebug, logError, logTrace } = require('../services/logger.service');

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe scope level
const ResultTypes = {
  BRANCHES: 'BRANCHES',
  ROUTERS: 'ROUTERS',
  OLTS: 'OLTS',
  ODCS: 'ODCS',
  ODPS: 'ODPS',
  ONTS: 'ONTS',
  BASIC: 'BASIC',
  FULL: 'FULL'
};

/**
 * Membuat basic branch entity (minimal fields)
 * @param {Object} data - Data branch
 * @returns {Object} Basic branch entity
 */
function createBasicBranchEntity(data) {
  return {
    _id: data._id,
    name: data.name,
    address: data.address,
    location: data.location,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

/**
 * Membuat list basic branch entity
 * @param {Array} dataList - Array of branch data
 * @returns {Array} Array of basic branch entities
 */
function createBasicBranchListEntity(dataList) {
  return dataList.map(data => createBasicBranchEntity(data));
}

/**
 * Membuat full branch entity dengan semua fields
 * @param {Object} data - Data branch
 * @returns {Object} Full branch entity
 */
function createFullBranchEntity(data) {
  return {
    ...data,
    _id: data._id
  };
}

/**
 * Membuat list full branch entity
 * @param {Array} dataList - Array of branch data
 * @returns {Array} Array of full branch entities
 */
function createFullBranchListEntity(dataList) {
  return dataList.map(data => createFullBranchEntity(data));
}

/**
 * Membuat branch list entity dengan level detail tertentu
 * @param {Array} dataList - Array of branch data
 * @returns {Array} Array of branch entities
 */
function createBranchListEntity(dataList) {
  return dataList.map(data => createBranchEntity(data));
}

/**
 * Mendapatkan semua branches
 * @param {string} resultType - Tipe result yang diinginkan
 * @param {string} deletedFilter - Filter untuk deleted
 * @param {Array<ObjectId>} accessibleBranchIds - List branch ID yang bisa diakses
 * @returns {Promise<Array>} List branch
 */
async function getAllBranches(resultType = ResultTypes.BASIC, deletedFilter = DeletedFilterTypes.WITHOUT, accessibleBranchIds = null) {
  try {
    const collection = getCollection('branches');
    let query = {};

    // Filter deleted
    if (deletedFilter === DeletedFilterTypes.WITHOUT) {
      query.deleted = { $ne: true };
    } else if (deletedFilter === DeletedFilterTypes.ONLY) {
      query.deleted = true;
    }

    // Filter berdasarkan accessible branches jika ada
    if (accessibleBranchIds && accessibleBranchIds.length > 0) {
      query._id = { $in: accessibleBranchIds.map(id => new ObjectId(id)) };
    }

    const result = await collection.find(query).toArray();

    // Transform result sesuai tipe yang diminta
    if (resultType === ResultTypes.BASIC) {
      return createBasicBranchListEntity(result);
    } else if (resultType === ResultTypes.FULL) {
      return createFullBranchListEntity(result);
    } else {
      return createBranchListEntity(result);
    }
  } catch (error) {
    logError('Error getting all branches:', error);
    throw error;
  }
}

/**
 * Mendapatkan branch berdasarkan ID dengan level detail tertentu
 * @param {string} id - ID branch
 * @param {string} scopeLevel - Level scope data (BRANCHES, ROUTERS, OLTS, ODCS, ODPS, ONTS)
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data branch sesuai level detail dan filter
 */
async function getBranchById(id, scopeLevel = null, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    const collection = getCollection(COLLECTION);
    const branch = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!branch) {
      return null;
    }
    
    // Terapkan recursive deleted check
    return recursiveDeletedCheck(branch, deletedFilter, scopeLevel);
  } catch (error) {
    console.error('Error getting branch by ID:', error);
    throw error;
  }
}

/**
 * Membuat branch baru
 * @param {Object} branchData - Data branch yang akan dibuat
 * @returns {Promise<Object>} - Data branch yang sudah dibuat
 */
async function createBranch(branchData) {
  try {
    const collection = getCollection(COLLECTION);
    const branch = createBranchEntity(branchData);
    const result = await collection.insertOne(branch);
    return { ...branch, _id: result.insertedId };
  } catch (error) {
    console.error('Error creating branch:', error);
    throw error;
  }
}

/**
 * Mengupdate branch berdasarkan ID
 * @param {string} id - ID branch
 * @param {Object} branchData - Data branch yang akan diupdate
 * @returns {Promise<Object>} - Data branch yang sudah diupdate
 */
async function updateBranch(id, branchData) {
  try {
    const collection = getCollection(COLLECTION);
    const branch = createBranchEntity(branchData);
    delete branch._id; // Hapus _id agar tidak diupdate
    
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: branch }
    );
    
    // Panggil getBranchById tanpa parameter result untuk mendapatkan data lengkap
    return getBranchById(id, null);
  } catch (error) {
    console.error(`Error updating branch with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Menghapus branch berdasarkan ID
 * @param {string} id - ID branch
 * @returns {Promise<boolean>} - True jika berhasil dihapus
 */
async function deleteBranch(id) {
  try {
    const collection = getCollection(COLLECTION);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting branch with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Menambahkan router ke branch berdasarkan ID branch
 * @param {string} id - ID branch
 * @param {Object} routerData - Data router yang akan ditambahkan
 * @returns {Promise<Object>} - Data branch yang sudah diupdate dengan router baru
 */
async function addRouterToBranch(id, routerData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Buat entity router dengan ObjectId baru
    const routerId = new ObjectId();
    const router = createNetDeviceRouterEntity({
      ...routerData,
      _id: routerId
    });
    
    // Update branch, tambahkan router ke children
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $push: { children: router },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Panggil getBranchById tanpa parameter result untuk mendapatkan data lengkap
    return getBranchById(id, null);
  } catch (error) {
    console.error(`Error adding router to branch with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Melakukan restore pada branch yang telah di-soft delete
 * @param {string} branchId - ID branch yang akan di-restore
 * @returns {Promise<Object|null>} - Hasil restore atau null jika branch tidak ditemukan/tidak bisa di-restore
 */
async function restore(branchId) {
  try {
    console.log(`[restore] Mencoba restore branch dengan ID: ${branchId}`);
    
    // Import fungsi restore
    const { restoreBranch } = require('../utils/recursiveRestore.util');
    
    // Cari branch yang memiliki deleted_at
    const branch = await getBranchById(branchId, null, DeletedFilterTypes.ONLY);
    console.log(`[restore] Status pencarian branch yang dihapus:`, branch ? 'Ditemukan' : 'Tidak ditemukan');
    
    if (!branch) {
      console.log('[restore] Branch tidak ditemukan atau sudah di-restore');
      return null;
    }

    // Simpan timestamp deleted_at untuk digunakan dalam restore
    const deletedAt = branch.deleted_at;
    console.log(`[restore] Branch ditemukan dengan deleted_at: ${deletedAt}`);
    
    // Lakukan restore
    console.log('[restore] Memanggil fungsi restoreBranch');
    const result = await restoreBranch(branchId, deletedAt);
    console.log(`[restore] Hasil restore:`, result ? 'Berhasil' : 'Gagal');
    
    if (!result) {
      console.log('[restore] Gagal melakukan restore branch');
      return null;
    }
    
    // Ambil data branch yang sudah di-restore
    const restoredBranch = await getBranchById(branchId, null, DeletedFilterTypes.WITHOUT);
    console.log('[restore] Berhasil mengambil data branch yang sudah di-restore');
    
    return restoredBranch;
  } catch (error) {
    console.error('[restore] Error saat melakukan restore branch:', error);
    throw error;
  }
}

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  addRouterToBranch,
  ResultTypes,
  DeletedFilterTypes,
  restore,
  createBasicBranchEntity,
  createBasicBranchListEntity,
  createFullBranchEntity,
  createFullBranchListEntity,
  createBranchListEntity
};
