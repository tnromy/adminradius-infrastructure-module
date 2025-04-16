/**
 * Repository untuk operasi pada collection branches terkait net device ONT
 */

const { getCollection } = require('./database.connector');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');

// Nama collection
const COLLECTION = 'branches';

/**
 * Mendapatkan ONT berdasarkan ID
 * @param {string} ontId - ID ONT
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data ONT
 */
async function getOntById(ontId, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    const branchCollection = getCollection('branches');
    
    // Pipeline aggregation untuk mencari ONT berdasarkan ID
    const pipeline = [
      // Unwind array children (router)
      { $unwind: { path: '$children', preserveNullAndEmptyArrays: true } },
      
      // Unwind array children dari router (OLT)
      { $unwind: { path: '$children.children', preserveNullAndEmptyArrays: true } },
      
      // Unwind array pon_port dari OLT
      { $unwind: { path: '$children.children.pon_port', preserveNullAndEmptyArrays: true } },
      
      // Unwind array children dari pon_port (ODC)
      { $unwind: { path: '$children.children.pon_port.children', preserveNullAndEmptyArrays: true } },
      
      // Unwind array trays dari ODC
      { $unwind: { path: '$children.children.pon_port.children.trays', preserveNullAndEmptyArrays: true } },
      
      // Unwind array children dari tray (ODP)
      { $unwind: { path: '$children.children.pon_port.children.trays.children', preserveNullAndEmptyArrays: true } },
      
      // Unwind array children dari ODP (ONT)
      { $unwind: { path: '$children.children.pon_port.children.trays.children.children', preserveNullAndEmptyArrays: true } },
      
      // Match ONT ID yang diinginkan
      { $match: { 'children.children.pon_port.children.trays.children.children._id': new ObjectId(ontId) } },
      
      // Project hanya data ONT
      { $project: { ont: '$children.children.pon_port.children.trays.children.children', _id: 0 } }
    ];
    
    // Tambahkan filter deleted
    if (deletedFilter === DeletedFilterTypes.ONLY) {
      pipeline[7].$match['children.children.pon_port.children.trays.children.children.deleted_at'] = { $exists: true };
    } else if (deletedFilter === DeletedFilterTypes.WITHOUT) {
      pipeline[7].$match['children.children.pon_port.children.trays.children.children.deleted_at'] = { $exists: false };
    }
    // Jika WITH, tidak perlu filter tambahan
    
    const result = await branchCollection.aggregate(pipeline).toArray();
    
    if (!result || result.length === 0 || !result[0].ont) {
      return null;
    }
    
    return result[0].ont;
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
    const collection = getCollection(COLLECTION);
    
    // Menggunakan update dengan dot notation langsung ke ONT berdasarkan ID
    const updateResult = await collection.updateOne(
      { 'children.children.pon_port.children.trays.children.children._id': new ObjectId(ontId) },
      { 
        $set: { 
          'children.$[router].children.$[olt].pon_port.$[port].children.$[odc].trays.$[tray].children.$[odp].children.$[ont].deleted_at': new Date(),
          updatedAt: new Date()
        } 
      },
      {
        // Array filters untuk mengidentifikasi path ke ONT yang tepat
        arrayFilters: [
          { 'router.children': { $exists: true } },
          { 'olt.pon_port': { $exists: true } },
          { 'port.children': { $exists: true } },
          { 'odc.trays': { $exists: true } },
          { 'tray.children': { $exists: true } },
          { 'odp.children': { $exists: true } },
          { 'ont._id': new ObjectId(ontId) }
        ]
      }
    );
    
    if (updateResult.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan ONT yang sudah diupdate (dengan WITH filter karena sudah dihapus)
    return getOntById(ontId, DeletedFilterTypes.WITH);
  } catch (error) {
    console.error('Error soft deleting ONT:', error);
    throw error;
  }
}

module.exports = {
  getOntById,
  softDeleteOnt
}; 