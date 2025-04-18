/**
 * Repository untuk operasi CRUD pada collection branches
 */

const { getCollection } = require('./database.connector');
const { createBranchEntity } = require('../entities/branch.entity');
const { createNetDeviceRouterEntity } = require('../entities/netDeviceRouter.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { recursiveDeletedCheck, DeletedFilterTypes } = require('../utils/recursiveDeletedCheck.util');

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe scope level
const ResultTypes = {
  BRANCHES: 'BRANCHES',
  ROUTERS: 'ROUTERS',
  OLTS: 'OLTS',
  ODCS: 'ODCS',
  ODPS: 'ODPS',
  ONTS: 'ONTS'
};

/**
 * Mendapatkan semua branches dengan level detail tertentu
 * @param {string} scopeLevel - Level scope data (BRANCHES, ROUTERS, OLTS, ODCS, ODPS, ONTS)
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Array>} - Array berisi data branches sesuai level detail dan filter
 */
async function getAllBranches(scopeLevel = null, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    const collection = getCollection(COLLECTION);
    const branches = await collection.find({}).toArray();
    
    // Terapkan recursive deleted check pada setiap branch
    const filteredBranches = branches
      .map(branch => recursiveDeletedCheck(branch, deletedFilter, scopeLevel))
      .filter(branch => branch !== null);
    
    return filteredBranches;
  } catch (error) {
    console.error('Error getting all branches:', error);
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

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  addRouterToBranch,
  ResultTypes,
  DeletedFilterTypes
};
