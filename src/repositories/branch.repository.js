/**
 * Repository untuk operasi CRUD pada collection branches
 */

const { getCollection } = require('./database.connector');
const { createBranchEntity } = require('../entities/branch.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Nama collection
const COLLECTION = 'branches';

/**
 * Mendapatkan semua branches
 * @returns {Promise<Array>} - Array berisi data branches
 */
async function getAllBranches() {
  try {
    const collection = getCollection(COLLECTION);
    const branches = await collection.find({}).toArray();
    return branches.map(branch => createBranchEntity(branch));
  } catch (error) {
    console.error('Error getting branches:', error);
    throw error;
  }
}

/**
 * Mendapatkan branch berdasarkan ID
 * @param {string} id - ID branch
 * @returns {Promise<Object>} - Data branch
 */
async function getBranchById(id) {
  try {
    const collection = getCollection(COLLECTION);
    const branch = await collection.findOne({ _id: new ObjectId(id) });
    return branch ? createBranchEntity(branch) : null;
  } catch (error) {
    console.error(`Error getting branch with ID ${id}:`, error);
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
    
    return getBranchById(id);
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

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
};
