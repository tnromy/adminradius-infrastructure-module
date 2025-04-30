const { ObjectId } = require('mongodb');
const { getCollection } = require('./database.connector');
const { createBranchAccessEntity, createBranchAccessListEntity } = require('../entities/branchAccess.entity');
const { logDebug, logError } = require('../services/logger.service');
const { BranchAccessStatus } = require('../entities/branchAccess.entity');

/**
 * Repository untuk operasi branch access
 */
class BranchAccessRepository {
  /**
   * Mencari branch access berdasarkan ID
   * @param {string} id - ID branch access
   * @returns {Promise<Object|null>} Branch access jika ditemukan
   */
  async findById(id) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.findOne({ 
        _id: new ObjectId(id)
      });

      logDebug('Finding branch access by ID', {
        branchAccessId: id,
        found: !!result
      });

      return result;
    } catch (error) {
      logError('Error finding branch access by ID:', error);
      throw error;
    }
  }

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
      
      const result = await collection.find({ 
        user_id: userId,
        status: status,
        permission: { $in: ['R', 'RW'] } // Pastikan hanya mengambil yang memiliki permission valid
      }).toArray();

      logDebug('Retrieved branch access by user and status', {
        userId,
        status,
        count: result.length,
        permissions: result.map(access => access.permission) // Menampilkan permission yang ditemukan
      });

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
      
      const result = await collection.find({ 
        status, 
        permission: { $in: ['R', 'RW'] } // Pastikan hanya mengambil yang memiliki permission valid
      }).toArray();
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
          status: status,
          permission: { $in: ['R', 'RW'] } // Pastikan hanya mengambil yang memiliki permission valid
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

  /**
   * Mendapatkan list branch yang dapat diakses oleh user
   * @param {string} userId - ID user
   * @returns {Promise<Array>} List branch access yang approved
   */
  async getAccessibleBranches(userId) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.find({
        user_id: userId,
        status: BranchAccessStatus.APPROVED,
        permission: { $in: ['R', 'RW'] } // Hanya mengambil branch dengan permission R atau RW
      }).toArray();

      logDebug('Retrieved accessible branches', {
        userId,
        count: result.length
      });

      return result;
    } catch (error) {
      logError('Error getting accessible branches:', error);
      throw error;
    }
  }

  /**
   * Memeriksa akses user terhadap branch tertentu
   * @param {string} userId - ID user
   * @param {ObjectId} branchId - ID branch
   * @returns {Promise<Object|null>} Branch access jika ada dan approved
   */
  async checkAccess(userId, branchId) {
    try {
      const collection = getCollection('branch_access');
      
      const access = await collection.findOne({
        user_id: userId,
        branch_id: branchId,
        status: BranchAccessStatus.APPROVED,
        permission: { $in: ['R', 'RW'] } // Memastikan permission adalah R atau RW
      });

      logDebug('Checked branch access', {
        userId,
        branchId: branchId.toString(),
        hasAccess: !!access,
        permission: access ? access.permission : null
      });

      return access;
    } catch (error) {
      logError('Error checking branch access:', error);
      throw error;
    }
  }

  /**
   * Mencari branch access yang approved berdasarkan branch_id dan user_id
   * @param {string} branchId - ID branch
   * @param {string} userId - ID user
   * @returns {Promise<Object|null>} Branch access yang approved jika ditemukan
   */
  async findApprovedBranchAccessByBranchIdAndUserId(branchId, userId) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.findOne(
        { 
          branch_id: new ObjectId(branchId),
          user_id: userId,
          status: BranchAccessStatus.APPROVED,
          permission: { $in: ['R', 'RW'] } // Hanya mengambil permission R atau RW
        },
        { sort: { created_at: -1 } }
      );

      logDebug('Finding approved branch access', {
        branchId,
        userId,
        found: !!result,
        permission: result ? result.permission : null
      });

      return result;
    } catch (error) {
      logError('Error finding approved branch access:', error);
      throw error;
    }
  }

  /**
   * Mendapatkan semua branch access yang approved untuk user tertentu
   * @param {string} userId - ID user
   * @returns {Promise<Array>} List branch access yang approved
   */
  async getApprovedBranchAccessByUserId(userId) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.find({
        user_id: userId,
        status: BranchAccessStatus.APPROVED,
        permission: { $in: ['R', 'RW'] } // Hanya mengambil permission R atau RW
      }).toArray();

      logDebug('Retrieved approved branch access list', {
        userId,
        count: result.length
      });

      return createBranchAccessListEntity(result);
    } catch (error) {
      logError('Error getting approved branch access list:', error);
      throw error;
    }
  }

  /**
   * Mendapatkan list branch ID yang diizinkan untuk user
   * @param {string} userId - ID user
   * @returns {Promise<Array<ObjectId>>} List branch ID yang diizinkan
   */
  async getAccessibleBranchIds(userId) {
    try {
      const collection = getCollection('branch_access');
      
      const result = await collection.find({
        user_id: userId,
        permission: { $in: ['R', 'RW'] }, // Hanya R atau RW
        status: BranchAccessStatus.APPROVED
      }).toArray();

      logDebug('Retrieved accessible branch IDs', {
        userId,
        count: result.length
      });

      // Return array of branch_id
      return result.map(access => access.branch_id);
    } catch (error) {
      logError('Error getting accessible branch IDs:', error);
      throw error;
    }
  }
}

module.exports = new BranchAccessRepository(); 