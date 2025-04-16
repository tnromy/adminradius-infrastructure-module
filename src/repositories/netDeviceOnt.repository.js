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
    const objectId = new ObjectId(ontId);
    
    // Pipeline aggregation untuk mencari branch yang berisi ONT dengan ID tertentu
    const pipeline = [
      // Match branches yang memiliki ONT dengan ID tertentu
      {
        $match: {
          'children.children.pon_port.children.trays.children.children._id': objectId
        }
      }
    ];
    
    // Tambahkan filter deleted
    if (deletedFilter === DeletedFilterTypes.ONLY) {
      pipeline[0].$match['children.children.pon_port.children.trays.children.children.deleted_at'] = { $exists: true };
    } else if (deletedFilter === DeletedFilterTypes.WITHOUT) {
      pipeline[0].$match['children.children.pon_port.children.trays.children.children.deleted_at'] = { $exists: false };
    }
    
    // Eksekusi query untuk mendapatkan branch
    const branches = await branchCollection.aggregate(pipeline).toArray();
    
    if (!branches || branches.length === 0) {
      return null;
    }
    
    // Ambil branch pertama yang memiliki ONT tersebut
    const branch = branches[0];
    
    // Variabel untuk menyimpan indeks dan data
    let routerIndex = -1;
    let oltIndex = -1;
    let ponPortIndex = -1;
    let odcIndex = -1;
    let trayIndex = -1;
    let odpIndex = -1;
    let ontIndex = -1;
    let ontData = null;
    
    // Loop melalui branch > router > olt > pon_port > odc > tray > odp > ont
    outerLoop: for (let i = 0; i < branch.children.length; i++) {
      const router = branch.children[i];
      
      if (router.children && Array.isArray(router.children)) {
        for (let j = 0; j < router.children.length; j++) {
          const olt = router.children[j];
          
          if (olt.pon_port && Array.isArray(olt.pon_port)) {
            for (let k = 0; k < olt.pon_port.length; k++) {
              const ponPort = olt.pon_port[k];
              
              if (ponPort.children && Array.isArray(ponPort.children)) {
                for (let l = 0; l < ponPort.children.length; l++) {
                  const odc = ponPort.children[l];
                  
                  if (odc.trays && Array.isArray(odc.trays)) {
                    for (let m = 0; m < odc.trays.length; m++) {
                      const tray = odc.trays[m];
                      
                      if (tray.children && Array.isArray(tray.children)) {
                        for (let n = 0; n < tray.children.length; n++) {
                          const odp = tray.children[n];
                          
                          if (odp.children && Array.isArray(odp.children)) {
                            for (let o = 0; o < odp.children.length; o++) {
                              const ont = odp.children[o];
                              
                              if (ont._id.toString() === ontId.toString()) {
                                routerIndex = i;
                                oltIndex = j;
                                ponPortIndex = k;
                                odcIndex = l;
                                trayIndex = m;
                                odpIndex = n;
                                ontIndex = o;
                                ontData = ont;
                                break outerLoop;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Jika ONT tidak ditemukan
    if (!ontData) {
      return null;
    }
    
    // Return objek dengan data ONT dan indeksnya
    return {
      ont: ontData,
      branchId: branch._id,
      routerIndex,
      oltIndex,
      ponPortIndex,
      odcIndex,
      trayIndex,
      odpIndex,
      ontIndex
    };
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
    // Dapatkan informasi ONT
    const ontInfo = await getOntById(ontId, DeletedFilterTypes.WITHOUT);
    
    if (!ontInfo || !ontInfo.ont) {
      return null;
    }
    
    const { 
      branchId, routerIndex, oltIndex, ponPortIndex, odcIndex, trayIndex, odpIndex, ontIndex 
    } = ontInfo;
    
    const collection = getCollection(COLLECTION);
    
    // Path untuk update
    const ontPath = `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.children.${ontIndex}.deleted_at`;
    
    // Update branch, tambahkan timestamp deleted_at ke ONT
    const result = await collection.updateOne(
      { _id: branchId },
      { 
        $set: { 
          [ontPath]: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan ONT yang sudah diupdate (dengan WITH filter karena sudah di-soft delete)
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