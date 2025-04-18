/**
 * Repository untuk operasi pada collection branches terkait net device OLT
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOdcEntity } = require('../entities/netDeviceOdc.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');
const { restoreOlt } = require('../utils/recursiveRestore.util');

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
    console.log(`[getOltById] Mencari OLT dengan ID: ${oltId}, filter: ${deletedFilter}`);
    const collection = getCollection(COLLECTION);
    const objectId = new ObjectId(oltId);
    
    // Cari branch yang memiliki OLT dengan ID tertentu
    const branch = await collection.findOne({
      'children.children._id': objectId
    });
    
    console.log(`[getOltById] Branch ditemukan: ${branch ? 'Ya' : 'Tidak'}`);
    
    if (!branch) return null;
    
    // Variabel untuk menyimpan indeks dan data
    let routerIndex = -1;
    let oltIndex = -1;
    let oltData = null;
    
    // Loop melalui branch > router > olt
    outerLoop: for (let i = 0; i < branch.children.length; i++) {
      const router = branch.children[i];
      
      if (router.children && Array.isArray(router.children)) {
        for (let j = 0; j < router.children.length; j++) {
          const olt = router.children[j];
          
          if (olt._id.toString() === oltId.toString()) {
            console.log(`[getOltById] OLT ditemukan dengan deleted_at: ${olt.deleted_at || 'tidak ada'}`);
            
            // Periksa filter
            if (deletedFilter === DeletedFilterTypes.ONLY && !olt.deleted_at) {
              console.log('[getOltById] OLT tidak memiliki deleted_at, tapi filter ONLY');
              continue;
            }
            if (deletedFilter === DeletedFilterTypes.WITHOUT && olt.deleted_at) {
              console.log('[getOltById] OLT memiliki deleted_at, tapi filter WITHOUT');
              continue;
            }
            
            routerIndex = i;
            oltIndex = j;
            oltData = olt;
            break outerLoop;
          }
        }
      }
    }
    
    // Jika OLT tidak ditemukan atau tidak memenuhi filter
    if (!oltData) {
      console.log('[getOltById] OLT tidak ditemukan atau tidak memenuhi filter');
      return null;
    }
    
    console.log('[getOltById] OLT berhasil ditemukan dan memenuhi filter');
    
    // Return objek dengan data OLT dan indeksnya
    return {
      olt: oltData,
      branchId: branch._id,
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

/**
 * Melakukan restore pada OLT yang telah di-soft delete
 * @param {string} oltId - ID OLT yang akan di-restore
 * @returns {Promise<Object|null>} - Hasil restore atau null jika OLT tidak ditemukan/tidak bisa di-restore
 */
async function restore(oltId) {
  try {
    console.log(`[restore] Mencoba restore OLT dengan ID: ${oltId}`);
    
    // Cari OLT yang memiliki deleted_at
    const oltInfo = await getOltById(oltId, DeletedFilterTypes.ONLY);
    console.log(`[restore] Status pencarian OLT yang dihapus:`, oltInfo);
    
    if (!oltInfo || !oltInfo.olt) {
      console.log('[restore] OLT tidak ditemukan atau sudah di-restore');
      return null;
    }
    
    // Lakukan restore
    console.log('[restore] Memanggil fungsi restoreOlt');
    const result = await restoreOlt(oltId);
    console.log(`[restore] Hasil restore:`, result);
    
    return result;
  } catch (error) {
    console.error('Error in OLT repository - restore:', error);
    throw error;
  }
}

module.exports = {
  getOltById,
  getOltDetailById,
  addOdcToOlt,
  restore,
  ResultTypes
}; 