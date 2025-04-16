/**
 * Repository untuk operasi pada collection branches terkait net device ODP
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOntEntity } = require('../entities/netDeviceOnt.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe result
const ResultTypes = {
  ODPS: 'ODPS'
};

/**
 * Mendapatkan ODP berdasarkan ID
 * @param {string} odpId - ID ODP
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data ODP
 */
async function getOdpById(odpId, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    const branchCollection = getCollection('branches');
    const objectId = new ObjectId(odpId);
    
    // Pipeline aggregation untuk mencari branch yang berisi ODP dengan ID tertentu
    const pipeline = [
      // Match branches yang memiliki ODP dengan ID tertentu
      {
        $match: {
          'children.children.pon_port.children.trays.children._id': objectId
        }
      }
    ];
    
    // Tambahkan filter deleted
    if (deletedFilter === DeletedFilterTypes.ONLY) {
      pipeline[0].$match['children.children.pon_port.children.trays.children.deleted_at'] = { $exists: true };
    } else if (deletedFilter === DeletedFilterTypes.WITHOUT) {
      pipeline[0].$match['children.children.pon_port.children.trays.children.deleted_at'] = { $exists: false };
    }
    
    // Eksekusi query untuk mendapatkan branch
    const branches = await branchCollection.aggregate(pipeline).toArray();
    
    if (!branches || branches.length === 0) {
      return null;
    }
    
    // Ambil branch pertama yang memiliki ODP tersebut
    const branch = branches[0];
    
    // Variabel untuk menyimpan indeks dan data
    let routerIndex = -1;
    let oltIndex = -1;
    let ponPortIndex = -1;
    let odcIndex = -1;
    let trayIndex = -1;
    let odpIndex = -1;
    let odpData = null;
    
    // Loop melalui branch > router > olt > pon_port > odc > tray > odp
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
                          
                          if (odp._id.toString() === odpId.toString()) {
                            routerIndex = i;
                            oltIndex = j;
                            ponPortIndex = k;
                            odcIndex = l;
                            trayIndex = m;
                            odpIndex = n;
                            odpData = odp;
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
    
    // Jika ODP tidak ditemukan
    if (!odpData) {
      return null;
    }
    
    // Return objek dengan data ODP dan indeksnya
    return {
      odp: odpData,
      branchId: branch._id,
      routerIndex,
      oltIndex,
      ponPortIndex,
      odcIndex,
      trayIndex,
      odpIndex
    };
  } catch (error) {
    console.error('Error getting ODP by ID:', error);
    throw error;
  }
}

/**
 * Mendapatkan detail ODP berdasarkan ID dengan level detail tertentu
 * @param {string} odpId - ID ODP
 * @param {string} resultType - Tipe hasil (ODPS)
 * @returns {Promise<Object>} - Data ODP sesuai level detail
 */
async function getOdpDetailById(odpId, resultType = null) {
  try {
    const odpInfo = await getOdpById(odpId);
    
    if (!odpInfo || !odpInfo.odp) {
      return null;
    }
    
    // Ambil data ODP
    const odp = odpInfo.odp;
    
    // Jika resultType tidak dispesifikasikan, kembalikan data lengkap seperti biasa
    if (!resultType || !Object.values(ResultTypes).includes(resultType)) {
      return odpInfo;
    }
    
    // Filter data sesuai resultType
    const odpCopy = { ...odp };
    
    // ODPS: Hapus children dari ODP
    if (resultType === ResultTypes.ODPS) {
      delete odpCopy.children;
      return {
        ...odpInfo,
        odp: odpCopy
      };
    }
    
    return odpInfo;
  } catch (error) {
    console.error(`Error getting ODP detail with ID ${odpId}:`, error);
    throw error;
  }
}

/**
 * Menambahkan ONT ke ODP
 * @param {string} odpId - ID ODP
 * @param {Object} ontData - Data ONT yang akan ditambahkan
 * @returns {Promise<Object>} - Data ODP yang sudah diupdate dengan ONT baru
 */
async function addOntToOdp(odpId, ontData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Dapatkan informasi ODP
    const odpInfo = await getOdpById(odpId);
    if (!odpInfo || !odpInfo.odp) {
      return null;
    }
    
    const { 
      odp, branchId, routerIndex, oltIndex, 
      ponPortIndex, odcIndex, trayIndex, odpIndex 
    } = odpInfo;
    
    // Validasi jumlah ONT tidak melebihi kapasitas port ODP
    const maxAvailablePort = odp.available_port || 0;
    const currentOntCount = odp.children ? odp.children.length : 0;
    
    if (currentOntCount >= maxAvailablePort) {
      throw new Error(`ODP port capacity exceeded. Maximum port: ${maxAvailablePort}, current ONT count: ${currentOntCount}`);
    }

    // Buat entity ONT dengan ObjectId baru
    const ontId = new ObjectId();
    const ont = createNetDeviceOntEntity({
      ...ontData,
      _id: ontId
    });
    
    // Path untuk update
    const odpPath = `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.children`;
    
    // Update branch, tambahkan ONT ke ODP
    const result = await collection.updateOne(
      { _id: branchId },
      { 
        $push: { [odpPath]: ont },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan ODP yang sudah diupdate
    return getOdpById(odpId);
  } catch (error) {
    console.error(`Error adding ONT to ODP with ID ${odpId}:`, error);
    throw error;
  }
}

module.exports = {
  getOdpById,
  getOdpDetailById,
  addOntToOdp,
  ResultTypes
}; 