const { ObjectId } = require('mongodb');
const { getCollection } = require('./database.connector');
const { createBranchAccess, validateBranchAccess } = require('../entities/branchAccess.entity');
const { logDebug, logError } = require('../services/logger.service');

class BranchAccessRepository {
  constructor() {
    this.collection = getCollection('branch_access');
  }

  /**
   * Memeriksa akses user ke branch tertentu
   * @param {string} userId - UUID dari user
   * @param {string|ObjectId} branchId - ID dari branch
   * @returns {Promise<Object|null>} - Document branch_access jika ditemukan
   */
  async checkAccess(userId, branchId) {
    try {
      const branchObjectId = typeof branchId === 'string' ? new ObjectId(branchId) : branchId;
      
      const access = await this.collection.findOne({
        user_id: userId,
        branch_id: branchObjectId
      });

      logDebug('Checked branch access', {
        userId,
        branchId: branchObjectId.toString(),
        hasAccess: !!access,
        permission: access?.permission
      });

      return access;
    } catch (error) {
      logError('Error checking branch access', {
        userId,
        branchId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mendapatkan list branch yang dapat diakses oleh user
   * @param {string} userId - UUID dari user
   * @returns {Promise<Array>} - Array dari branch_id yang dapat diakses
   */
  async getAccessibleBranches(userId) {
    try {
      const accessList = await this.collection.find({
        user_id: userId
      }).toArray();

      logDebug('Retrieved accessible branches', {
        userId,
        count: accessList.length
      });

      return accessList;
    } catch (error) {
      logError('Error getting accessible branches', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Menambahkan akses branch baru
   * @param {Object} data - Data akses branch
   * @returns {Promise<Object>} - Document yang dibuat
   */
  async addAccess(data) {
    try {
      validateBranchAccess(data);
      const branchAccess = createBranchAccess(data);
      
      await this.collection.insertOne(branchAccess);

      logDebug('Added branch access', {
        userId: data.user_id,
        branchId: branchAccess.branch_id.toString(),
        permission: data.permission
      });

      return branchAccess;
    } catch (error) {
      logError('Error adding branch access', {
        data,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mengupdate permission akses branch
   * @param {string} userId - UUID dari user
   * @param {string|ObjectId} branchId - ID dari branch
   * @param {string} permission - Permission baru (R/RW)
   * @returns {Promise<Object>} - Result dari update
   */
  async updateAccess(userId, branchId, permission) {
    try {
      const branchObjectId = typeof branchId === 'string' ? new ObjectId(branchId) : branchId;
      
      const result = await this.collection.updateOne(
        {
          user_id: userId,
          branch_id: branchObjectId
        },
        {
          $set: { permission }
        }
      );

      logDebug('Updated branch access', {
        userId,
        branchId: branchObjectId.toString(),
        permission,
        modified: result.modifiedCount
      });

      return result;
    } catch (error) {
      logError('Error updating branch access', {
        userId,
        branchId,
        permission,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Menghapus akses branch
   * @param {string} userId - UUID dari user
   * @param {string|ObjectId} branchId - ID dari branch
   * @returns {Promise<Object>} - Result dari delete
   */
  async removeAccess(userId, branchId) {
    try {
      const branchObjectId = typeof branchId === 'string' ? new ObjectId(branchId) : branchId;
      
      const result = await this.collection.deleteOne({
        user_id: userId,
        branch_id: branchObjectId
      });

      logDebug('Removed branch access', {
        userId,
        branchId: branchObjectId.toString(),
        deleted: result.deletedCount
      });

      return result;
    } catch (error) {
      logError('Error removing branch access', {
        userId,
        branchId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new BranchAccessRepository(); 