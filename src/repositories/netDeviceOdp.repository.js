/**
 * Repository untuk operasi pada collection branches terkait net device ODP
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOntEntity } = require('../entities/netDeviceOnt.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');
const { restoreOdp } = require('../utils/recursiveRestore.util');

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
    const { logDebug, logInfo, logWarn, logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    const context = getRequestContext();
    
    logDebug(`Mencari ODP dengan ID: ${odpId}, filter: ${deletedFilter}`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      filter: deletedFilter
    });
    
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
      logDebug('Menambahkan filter ONLY - mencari yang memiliki deleted_at', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId
      });
    } else if (deletedFilter === DeletedFilterTypes.WITHOUT) {
      pipeline[0].$match['children.children.pon_port.children.trays.children.deleted_at'] = { $exists: false };
      logDebug('Menambahkan filter WITHOUT - mencari yang tidak memiliki deleted_at', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId
      });
    }
    
    logDebug('Query MongoDB untuk mencari ODP', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      pipeline: JSON.stringify(pipeline)
    });
    
    // Eksekusi query untuk mendapatkan branch
    const branches = await branchCollection.aggregate(pipeline).toArray();
    logDebug(`Jumlah branches ditemukan: ${branches.length}`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      branchCount: branches.length
    });
    
    if (!branches || branches.length === 0) {
      logWarn('Tidak ada branch yang ditemukan untuk ODP', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId
      });
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
                            logDebug(`ODP ditemukan dengan deleted_at: ${odp.deleted_at || 'tidak ada'}`, {
                              requestId: context.getRequestId(),
                              userId: context.getUserId(),
                              odpId: odpId,
                              hasDeletedAt: !!odp.deleted_at
                            });
                            
                            // Periksa filter
                            if (deletedFilter === DeletedFilterTypes.ONLY && !odp.deleted_at) {
                              logDebug('ODP tidak memiliki deleted_at, tapi filter ONLY', {
                                requestId: context.getRequestId(),
                                userId: context.getUserId(),
                                odpId: odpId
                              });
                              continue;
                            }
                            if (deletedFilter === DeletedFilterTypes.WITHOUT && odp.deleted_at) {
                              logDebug('ODP memiliki deleted_at, tapi filter WITHOUT', {
                                requestId: context.getRequestId(),
                                userId: context.getUserId(),
                                odpId: odpId
                              });
                              continue;
                            }
                            
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
      logWarn('ODP tidak ditemukan atau tidak memenuhi filter', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId,
        filter: deletedFilter
      });
      return null;
    }
    
    logInfo('ODP berhasil ditemukan dan memenuhi filter', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      filter: deletedFilter,
      odpLabel: odpData.label || 'unknown'
    });
    
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
    const { logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    
    logError('Error getting ODP by ID:', {
      requestId: getRequestContext().getRequestId(),
      userId: getRequestContext().getUserId(),
      odpId: odpId,
      error: error.message,
      stack: error.stack
    });
    
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
    const { logDebug, logInfo, logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    const context = getRequestContext();
    
    logDebug(`Mencari detail ODP dengan ID: ${odpId}, result type: ${resultType || 'default'}`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      resultType: resultType || 'default'
    });
    
    const odpInfo = await getOdpById(odpId);
    
    if (!odpInfo || !odpInfo.odp) {
      logDebug(`ODP dengan ID ${odpId} tidak ditemukan`, {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId
      });
      return null;
    }
    
    // Ambil data ODP
    const odp = odpInfo.odp;
    
    // Jika resultType tidak dispesifikasikan, kembalikan data lengkap seperti biasa
    if (!resultType || !Object.values(ResultTypes).includes(resultType)) {
      logDebug(`Mengembalikan data ODP lengkap dengan ID: ${odpId}`, {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId,
        odpLabel: odp.label || 'unknown'
      });
      return odpInfo;
    }
    
    // Filter data sesuai resultType
    const odpCopy = { ...odp };
    
    // ODPS: Hapus children dari ODP
    if (resultType === ResultTypes.ODPS) {
      logDebug(`Mengembalikan data ODP yang difilter (tanpa ONT children) untuk ID: ${odpId}`, {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId,
        odpLabel: odp.label || 'unknown',
        resultType: resultType
      });
      
      delete odpCopy.children;
      return {
        ...odpInfo,
        odp: odpCopy
      };
    }
    
    return odpInfo;
  } catch (error) {
    const { logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    
    logError(`Error getting ODP detail with ID ${odpId}:`, {
      requestId: getRequestContext().getRequestId(),
      userId: getRequestContext().getUserId(),
      odpId: odpId,
      resultType: resultType || 'default',
      error: error.message,
      stack: error.stack
    });
    
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
    const { logDebug, logInfo, logWarn, logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    const context = getRequestContext();
    
    const collection = getCollection(COLLECTION);
    
    logDebug(`Memulai proses penambahan ONT ke ODP`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      ontLabel: ontData.label
    });
    
    // Dapatkan informasi ODP
    const odpInfo = await getOdpById(odpId);
    if (!odpInfo || !odpInfo.odp) {
      logWarn(`ODP tidak ditemukan untuk penambahan ONT`, {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId
      });
      return null;
    }
    
    const { 
      odp, branchId, routerIndex, oltIndex, 
      ponPortIndex, odcIndex, trayIndex, odpIndex 
    } = odpInfo;
    
    // Validasi jumlah ONT tidak melebihi kapasitas port ODP
    const maxAvailablePort = odp.available_port || 0;
    const currentOntCount = odp.children ? odp.children.length : 0;
    
    logDebug(`Validasi kapasitas port ODP untuk ONT baru`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      odpLabel: odp.label || 'unknown',
      maxAvailablePort: maxAvailablePort,
      currentOntCount: currentOntCount
    });
    
    if (currentOntCount >= maxAvailablePort) {
      const errorMsg = `ODP port capacity exceeded. Maximum port: ${maxAvailablePort}, current ONT count: ${currentOntCount}`;
      logWarn(errorMsg, {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId,
        odpLabel: odp.label || 'unknown',
        maxAvailablePort: maxAvailablePort,
        currentOntCount: currentOntCount
      });
      throw new Error(errorMsg);
    }

    // Buat entity ONT dengan ObjectId baru
    const ontId = new ObjectId();
    const ont = createNetDeviceOntEntity({
      ...ontData,
      _id: ontId
    });
    
    // Path untuk update
    const odpPath = `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.children`;
    
    logDebug(`Menambahkan ONT ke ODP menggunakan path: ${odpPath}`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      odpLabel: odp.label || 'unknown',
      branchId: branchId.toString(),
      ontId: ontId.toString()
    });
    
    // Update branch, tambahkan ONT ke ODP
    const result = await collection.updateOne(
      { _id: branchId },
      { 
        $push: { [odpPath]: ont },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      logWarn(`Gagal menambahkan ONT ke ODP, branch tidak ditemukan`, {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId,
        branchId: branchId.toString()
      });
      return null;
    }
    
    logInfo(`ONT berhasil ditambahkan ke ODP`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      odpLabel: odp.label || 'unknown',
      ontId: ontId.toString(),
      ontLabel: ont.label
    });
    
    // Dapatkan data ODP yang telah diupdate
    return getOdpById(odpId);
  } catch (error) {
    const { logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    
    logError(`Error in addOntToOdp:`, {
      requestId: getRequestContext().getRequestId(),
      userId: getRequestContext().getUserId(),
      odpId: odpId,
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * Melakukan restore pada ODP yang telah di-soft delete
 * @param {string} odpId - ID ODP yang akan di-restore
 * @returns {Promise<Object|null>} - Hasil restore atau null jika ODP tidak ditemukan/tidak bisa di-restore
 */
async function restore(odpId) {
  try {
    const { logDebug, logInfo, logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    const context = getRequestContext();
    
    logDebug(`Mencoba restore ODP dengan ID: ${odpId}`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId
    });
    
    // Cari ODP yang memiliki deleted_at
    const odpInfo = await getOdpById(odpId, DeletedFilterTypes.ONLY);
    
    if (!odpInfo || !odpInfo.odp) {
      logDebug('ODP tidak ditemukan atau sudah di-restore', {
        requestId: context.getRequestId(),
        userId: context.getUserId(),
        odpId: odpId
      });
      return null;
    }
    
    // Lakukan restore
    logDebug('Memanggil fungsi restoreOdp', {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      odpLabel: odpInfo.odp.label || 'unknown'
    });
    
    const result = await restoreOdp(odpId);
    
    logInfo(`ODP berhasil di-restore`, {
      requestId: context.getRequestId(),
      userId: context.getUserId(),
      odpId: odpId,
      hasil: !!result
    });
    
    return result;
  } catch (error) {
    const { logError } = require('../services/logger.service');
    const { getRequestContext } = require('../services/requestContext.service');
    
    logError('Error in ODP repository - restore:', {
      requestId: getRequestContext().getRequestId(),
      userId: getRequestContext().getUserId(),
      odpId: odpId,
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

module.exports = {
  getOdpById,
  getOdpDetailById,
  addOntToOdp,
  ResultTypes,
  restore
}; 