/**
 * Repository untuk operasi pada collection branches terkait net device ODC
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOdpEntity } = require('../entities/netDeviceOdp.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { DeletedFilterTypes } = require('./branch.repository');
const { restoreOdc } = require('../utils/recursiveRestore.util');

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe result
const ResultTypes = {
  ODCS: 'ODCS',
  ODPS: 'ODPS'
};

/**
 * Mendapatkan ODC berdasarkan ID
 * @param {string} odcId - ID ODC
 * @param {string} deletedFilter - Filter data yang dihapus (ONLY, WITH, WITHOUT)
 * @returns {Promise<Object>} - Data ODC
 */
async function getOdcById(odcId, deletedFilter = DeletedFilterTypes.WITHOUT) {
  try {
    console.log(`[getOdcById] Mencari ODC dengan ID: ${odcId}, filter: ${deletedFilter}`);
    const collection = getCollection('branches');
    const objectId = new ObjectId(odcId);
    
    // Cari branch yang memiliki ODC dengan ID tertentu
    const branch = await collection.findOne({
      'children.children.pon_port.children._id': objectId
    });
    
    console.log(`[getOdcById] Branch ditemukan: ${branch ? 'Ya' : 'Tidak'}`);
    
    if (!branch) return null;
    
    // Variabel untuk menyimpan indeks dan data
    let routerIndex = -1;
    let oltIndex = -1;
    let ponPortIndex = -1;
    let odcIndex = -1;
    let odcData = null;
    
    // Loop melalui branch > router > olt > pon_port > odc
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
                  
                  if (odc._id.toString() === odcId.toString()) {
                    console.log(`[getOdcById] ODC ditemukan dengan deleted_at: ${odc.deleted_at || 'tidak ada'}`);
                    
                    // Periksa filter
                    if (deletedFilter === DeletedFilterTypes.ONLY && !odc.deleted_at) {
                      console.log('[getOdcById] ODC tidak memiliki deleted_at, tapi filter ONLY');
                      continue;
                    }
                    if (deletedFilter === DeletedFilterTypes.WITHOUT && odc.deleted_at) {
                      console.log('[getOdcById] ODC memiliki deleted_at, tapi filter WITHOUT');
                      continue;
                    }
                    
                    routerIndex = i;
                    oltIndex = j;
                    ponPortIndex = k;
                    odcIndex = l;
                    odcData = odc;
                    break outerLoop;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Jika ODC tidak ditemukan atau tidak memenuhi filter
    if (!odcData) {
      console.log('[getOdcById] ODC tidak ditemukan atau tidak memenuhi filter');
      return null;
    }
    
    console.log('[getOdcById] ODC berhasil ditemukan dan memenuhi filter');
    
    // Return objek dengan data ODC dan indeksnya
    return {
      odc: odcData,
      branchId: branch._id,
      routerIndex,
      oltIndex,
      ponPortIndex,
      odcIndex
    };
  } catch (error) {
    console.error('Error getting ODC by ID:', error);
    throw error;
  }
}

/**
 * Mendapatkan detail ODC berdasarkan ID dengan level detail tertentu
 * @param {string} odcId - ID ODC
 * @param {string} resultType - Tipe hasil (ODCS, ODPS)
 * @returns {Promise<Object>} - Data ODC sesuai level detail
 */
async function getOdcDetailById(odcId, resultType = null) {
  try {
    const odcInfo = await getOdcById(odcId);
    
    if (!odcInfo || !odcInfo.odc) {
      return null;
    }
    
    // Ambil data ODC
    const odc = odcInfo.odc;
    
    // Jika resultType tidak dispesifikasikan, kembalikan data lengkap seperti biasa
    if (!resultType || !Object.values(ResultTypes).includes(resultType)) {
      return odcInfo;
    }
    
    // Filter data sesuai resultType
    const odcCopy = { ...odc };
    
    // ODCS: Hapus children dari setiap tray di trays
    if (resultType === ResultTypes.ODCS) {
      if (odcCopy.trays && Array.isArray(odcCopy.trays)) {
        odcCopy.trays = odcCopy.trays.map(tray => {
          const trayCopy = { ...tray };
          delete trayCopy.children;
          return trayCopy;
        });
      }
      return {
        ...odcInfo,
        odc: odcCopy
      };
    }
    
    // ODPS: Hapus children dari setiap ODP
    if (resultType === ResultTypes.ODPS) {
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
      return {
        ...odcInfo,
        odc: odcCopy
      };
    }
    
    return odcInfo;
  } catch (error) {
    console.error(`Error getting ODC detail with ID ${odcId}:`, error);
    throw error;
  }
}

/**
 * Menambahkan ODP ke ODC pada tray tertentu
 * @param {string} odcId - ID ODC
 * @param {Object} odpData - Data ODP yang akan ditambahkan
 * @returns {Promise<Object>} - Data ODC yang sudah diupdate dengan ODP baru
 */
async function addOdpToOdc(odcId, odpData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Dapatkan informasi ODC
    const odcInfo = await getOdcById(odcId);
    if (!odcInfo || !odcInfo.odc) {
      return null;
    }
    
    const { odc, branchId, routerIndex, oltIndex, ponPortIndex, odcIndex } = odcInfo;
    
    // Cari tray yang sesuai
    const trayIndex = odc.trays.findIndex(tray => tray.tray === odpData.tray);
    if (trayIndex === -1) {
      throw new Error(`Tray ${odpData.tray} not found on ODC ${odcId}`);
    }
    
    const tray = odc.trays[trayIndex];
    
    // Validasi core_on_odc_tray
    if (odpData.core_on_odc_tray < tray.start_core || odpData.core_on_odc_tray > tray.end_core) {
      throw new Error(`core_on_odc_tray value (${odpData.core_on_odc_tray}) out of range for tray ${odpData.tray}. Valid range: ${tray.start_core}-${tray.end_core}`);
    }
    
    // Simpan nilai tray untuk digunakan di entity, lalu hapus dari data input
    const trayNumber = odpData.tray;
    delete odpData.tray;
    
    // Buat entity ODP dengan ObjectId baru
    const odpId = new ObjectId();
    const odp = createNetDeviceOdpEntity({
      ...odpData,
      _id: odpId
    });
    
    // Path untuk update
    const trayPath = `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children`;
    
    // Update branch, tambahkan ODP ke tray ODC
    const result = await collection.updateOne(
      { _id: branchId },
      { 
        $push: { [trayPath]: odp },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan ODC yang sudah diupdate
    return getOdcById(odcId);
  } catch (error) {
    console.error(`Error adding ODP to ODC with ID ${odcId}:`, error);
    throw error;
  }
}

/**
 * Melakukan restore pada ODC yang telah di-soft delete
 * @param {string} odcId - ID ODC yang akan di-restore
 * @returns {Promise<Object|null>} - Hasil restore atau null jika ODC tidak ditemukan/tidak bisa di-restore
 */
async function restore(odcId) {
  try {
    const result = await restoreOdc(odcId);
    return result;
  } catch (error) {
    console.error('Error in ODC repository - restore:', error);
    throw error;
  }
}

module.exports = {
  getOdcById,
  getOdcDetailById,
  addOdpToOdc,
  ResultTypes,
  restore
}; 