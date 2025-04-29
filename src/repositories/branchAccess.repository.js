const { ObjectId } = require('mongodb');
const { getCollection } = require('./database.connector');
const { createBranchAccessEntity, createBranchAccessListEntity } = require('../entities/branchAccess.entity');
const { logDebug, logError } = require('../services/logger.service');

/**
 * Repository untuk operasi branch access
 */
class BranchAccessRepository {
  /**
   * Menambahkan branch access baru
   * @param {Object} data - Data branch access
   * @returns {Promise<Object>} Branch access yang ditambahkan
   */
  async addBranchAccess(data) {
    try {
      const collection = getCollection('branch_access');
      const branchAccess = createBranchAccessEntity(data);
      
      const result = await collection.insertOne(branchAccess);
      return { ...branchAccess, _id: result.insertedId };
    } catch (error) {
      logError('Error adding branch access:', error);
      throw error;
    }
  }

  /**
   * Update branch access berdasarkan ID
   * @param {string} id - ID branch access
   * @param {Object} updateData - Data yang akan diupdate
   * @returns {Promise<Object>} Branch access yang diupdate
   */
  async updateBranchAccess(id, updateData) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            ...updateData,
            updated_at: new Date()
          } 
        },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      logError('Error updating branch access:', error);
      throw error;
    }
  }

  /**
   * Mencari branch access berdasarkan branch_id dan user_id
   * @param {string} branchId - ID branch
   * @param {string} userId - ID user
   * @returns {Promise<Object>} Branch access
   */
  async findBranchAccessByBranchIdAndUserId(branchId, userId) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.findOne(
        { 
          branch_id: new ObjectId(branchId),
          user_id: userId
        },
        { sort: { created_at: -1 } }
      );

      return result;
    } catch (error) {
      logError('Error finding branch access:', error);
      throw error;
    }
  }

  /**
   * Mendapatkan list branch access berdasarkan user_id dan status
   * @param {string} userId - ID user
   * @param {string} status - Status branch access
   * @returns {Promise<Array>} List branch access
   */
  async getBranchAccessByUserIdAndStatus(userId, status) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.find(
        { 
          user_id: userId,
          status: status
        }
      ).toArray();

      return createBranchAccessListEntity(result);
    } catch (error) {
      logError('Error getting branch access list:', error);
      throw error;
    }
  }

  /**
   * Mendapatkan list branch access berdasarkan status
   * @param {string} status - Status branch access
   * @returns {Promise<Array>} List branch access
   */
  async getBranchAccessByStatus(status) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.find({ status }).toArray();
      return createBranchAccessListEntity(result);
    } catch (error) {
      logError('Error getting branch access by status:', error);
      throw error;
    }
  }

  /**
   * Mendapatkan list branch access berdasarkan branch_id dan status
   * @param {string} branchId - ID branch
   * @param {string} status - Status branch access
   * @returns {Promise<Array>} List branch access
   */
  async getBranchAccessByBranchIdAndStatus(branchId, status) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.find(
        { 
          branch_id: new ObjectId(branchId),
          status: status
        }
      ).toArray();

      return createBranchAccessListEntity(result);
    } catch (error) {
      logError('Error getting branch access by branch and status:', error);
      throw error;
    }
  }

  /**
   * Menghapus branch access berdasarkan ID
   * @param {string} id - ID branch access
   * @returns {Promise<boolean>} True jika berhasil dihapus
   */
  async deleteBranchAccess(id) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      logError('Error deleting branch access:', error);
      throw error;
    }
  }
}

module.exports = new BranchAccessRepository(); 