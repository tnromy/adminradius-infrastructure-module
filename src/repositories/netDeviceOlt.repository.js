/**
 * Repository untuk operasi pada collection branches terkait net device OLT
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOdcEntity } = require('../entities/netDeviceOdc.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe result
const ResultTypes = {
  OLTS: 'OLTS',
  ODCS: 'ODCS',
  ODPS: 'ODPS'
};

/**
 * Mendapatkan OLT berdasarkan ID
 * @param {string} oltId - ID OLT
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data OLT
 */
async function getOltById(oltId, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    const branchCollection = getCollection('branches');
    const objectId = new ObjectId(oltId);
    
    // Pipeline aggregation untuk mencari OLT berdasarkan ID
    const pipeline = [
      // Match branches yang memiliki OLT dengan ID tertentu
      {
        $match: {
          'children.children._id': objectId
        }
      }
    ];
    
    // Tambahkan filter deleted
    if (deletedFilter === DeletedFilterTypes.ONLY) {
      pipeline[0].$match['children.children.deleted_at'] = { $exists: true };
    } else if (deletedFilter === DeletedFilterTypes.WITHOUT) {
      pipeline[0].$match['children.children.deleted_at'] = { $exists: false };
    }
    
    // Eksekusi query untuk mendapatkan branch
    const branches = await branchCollection.aggregate(pipeline).toArray();
    
    if (!branches || branches.length === 0) {
      return null;
    }
    
    // Ambil branch pertama yang memiliki OLT tersebut
    const branch = branches[0];
    
    // Loop setiap router untuk menemukan OLT
    let routerIndex = -1;
    let oltIndex = -1;
    let oltData = null;
    
    // Loop untuk menemukan router dan OLT
    for (let i = 0; i < branch.children.length; i++) {
      const router = branch.children[i];
      
      if (router.children && Array.isArray(router.children)) {
        for (let j = 0; j < router.children.length; j++) {
          const olt = router.children[j];
          
          if (olt._id.toString() === oltId.toString()) {
            routerIndex = i;
            oltIndex = j;
            oltData = olt;
            break;
          }
        }
      }
      
      if (oltData) break;
    }
    
    // Jika OLT tidak ditemukan
    if (!oltData) {
      return null;
    }
    
    // Return objek dengan data OLT, branch, dan indeks
    return {
      olt: oltData,
      branch: {
        _id: branch._id,
        name: branch.name
      },
      routerIndex,
      oltIndex
    };
  } catch (error) {
    console.error('Error getting OLT by ID:', error);
    throw error;
  }
}

/**
 * Mendapatkan detail OLT berdasarkan ID dengan level detail tertentu
 * @param {string} oltId - ID OLT
 * @param {string} resultType - Tipe hasil (OLTS, ODCS, ODPS)
 * @returns {Promise<Object>} - Data OLT sesuai level detail
 */
async function getOltDetailById(oltId, resultType = null) {
  try {
    const oltInfo = await getOltById(oltId);
    
    if (!oltInfo || !oltInfo.olt) {
      return null;
    }
    
    // Ambil data OLT
    const olt = oltInfo.olt;
    
    // Jika resultType tidak dispesifikasikan, kembalikan data lengkap seperti biasa
    if (!resultType || !Object.values(ResultTypes).includes(resultType)) {
      return oltInfo;
    }
    
    // Filter data sesuai resultType
    const oltCopy = { ...olt };
    
    // OLTS: Hapus children dari setiap port di pon_port
    if (resultType === ResultTypes.OLTS) {
      if (oltCopy.pon_port && Array.isArray(oltCopy.pon_port)) {
        oltCopy.pon_port = oltCopy.pon_port.map(port => {
          const portCopy = { ...port };
          delete portCopy.children;
          return portCopy;
        });
      }
      return {
        ...oltInfo,
        olt: oltCopy
      };
    }
    
    // ODCS: Hapus children dari setiap tray di trays dari ODC
    if (resultType === ResultTypes.ODCS) {
      if (oltCopy.pon_port && Array.isArray(oltCopy.pon_port)) {
        oltCopy.pon_port = oltCopy.pon_port.map(port => {
          const portCopy = { ...port };
          
          if (portCopy.children && Array.isArray(portCopy.children)) {
            portCopy.children = portCopy.children.map(odc => {
              const odcCopy = { ...odc };
              
              // Tetap menyertakan trays tapi hapus children dari setiap tray
              if (odcCopy.trays && Array.isArray(odcCopy.trays)) {
                odcCopy.trays = odcCopy.trays.map(tray => {
                  const trayCopy = { ...tray };
                  delete trayCopy.children;
                  return trayCopy;
                });
              }
              
              return odcCopy;
            });
          }
          
          return portCopy;
        });
      }
      return {
        ...oltInfo,
        olt: oltCopy
      };
    }
    
    // ODPS: Hapus children dari setiap ODP
    if (resultType === ResultTypes.ODPS) {
      if (oltCopy.pon_port && Array.isArray(oltCopy.pon_port)) {
        oltCopy.pon_port = oltCopy.pon_port.map(port => {
          const portCopy = { ...port };
          
          if (portCopy.children && Array.isArray(portCopy.children)) {
            portCopy.children = portCopy.children.map(odc => {
              const odcCopy = { ...odc };
              
              if (odcCopy.trays && Array.isArray(odcCopy.trays)) {
                odcCopy.trays = odcCopy.trays.map(tray => {
                  const trayCopy = { ...tray };
                  
                  if (trayCopy.children && Array.isArray(trayCopy.children)) {
                    trayCopy.children = trayCopy.children.map(odp => {
                      const odpCopy = { ...odp };
                      delete odpCopy.children;
                      return odpCopy;
                    });
                  }
                  
                  return trayCopy;
                });
              }
              
              return odcCopy;
            });
          }
          
          return portCopy;
        });
      }
      return {
        ...oltInfo,
        olt: oltCopy
      };
    }
    
    return oltInfo;
  } catch (error) {
    console.error(`Error getting OLT detail with ID ${oltId}:`, error);
    throw error;
  }
}

/**
 * Menambahkan ODC ke OLT berdasarkan ID OLT pada port tertentu
 * @param {string} oltId - ID OLT
 * @param {Object} odcData - Data ODC yang akan ditambahkan
 * @returns {Promise<Object>} - Data OLT yang sudah diupdate dengan ODC baru di port tertentu
 */
async function addOdcToOlt(oltId, odcData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Dapatkan informasi OLT
    const oltInfo = await getOltById(oltId);
    if (!oltInfo || !oltInfo.olt) {
      return null;
    }
    
    const { olt, branch, routerIndex, oltIndex } = oltInfo;
    
    // Cari port yang sesuai dengan pon_port
    const ponPortIndex = olt.pon_port.findIndex(port => port.port === odcData.pon_port);
    if (ponPortIndex === -1) {
      throw new Error(`Port ${odcData.pon_port} not found on OLT ${oltId}`);
    }
    
    // Buat trays berdasarkan available_tray dan cores_per_tray
    const trays = [];
    const availableTray = odcData.available_tray || 0;
    const coresPerTray = odcData.cores_per_tray || 0;
    
    for (let i = 0; i < availableTray; i++) {
      trays.push({
        tray: i + 1,
        start_core: 1 + (coresPerTray * i),
        end_core: coresPerTray * (i + 1),
        children: []
      });
    }
    
    // Hapus properti pon_port dan cores_per_tray dari data
    delete odcData.pon_port;
    delete odcData.cores_per_tray;
    
    // Buat entity ODC dengan ObjectId baru
    const odcId = new ObjectId();
    const odc = createNetDeviceOdcEntity({
      ...odcData,
      _id: odcId,
      trays
    });
    
    // Path untuk update
    const oltPath = `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children`;
    
    // Update branch, tambahkan ODC ke port OLT
    const result = await collection.updateOne(
      { _id: branch._id },
      { 
        $push: { [oltPath]: odc },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan OLT yang sudah diupdate
    return getOltById(oltId);
  } catch (error) {
    console.error(`Error adding ODC to OLT with ID ${oltId}:`, error);
    throw error;
  }
}

module.exports = {
  getOltById,
  getOltDetailById,
  addOdcToOlt,
  ResultTypes
}; 