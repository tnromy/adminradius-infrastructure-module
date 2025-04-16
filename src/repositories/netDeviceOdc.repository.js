/**
 * Repository untuk operasi pada collection branches terkait net device ODC
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOdpEntity } = require('../entities/netDeviceOdp.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Nama collection
const COLLECTION = 'branches';

/**
 * Mencari ODC dan mendapatkan informasi path ke ODC
 * @param {string} odcId - ID ODC
 * @returns {Promise<Object>} - Data ODC dan path informasi
 */
async function getOdcById(odcId) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Mencari branch yang memiliki ODC berdasarkan ID
    const branch = await collection.findOne({
      'children.children.pon_port.children._id': new ObjectId(odcId)
    });
    
    if (!branch) {
      return null;
    }
    
    // Informasi path ke ODC
    let foundOdc = null;
    let branchId = branch._id;
    let routerIndex = -1;
    let oltIndex = -1;
    let ponPortIndex = -1;
    let odcIndex = -1;
    
    // Cari ODC dalam struktur bersarang
    outerLoop:
    for (let i = 0; i < branch.children.length; i++) {
      const router = branch.children[i];
      
      for (let j = 0; j < router.children.length; j++) {
        const olt = router.children[j];
        
        for (let k = 0; k < olt.pon_port.length; k++) {
          const ponPort = olt.pon_port[k];
          
          for (let l = 0; l < ponPort.children.length; l++) {
            const odc = ponPort.children[l];
            
            if (odc._id.toString() === odcId && odc.type === 'odc') {
              foundOdc = odc;
              routerIndex = i;
              oltIndex = j;
              ponPortIndex = k;
              odcIndex = l;
              break outerLoop;
            }
          }
        }
      }
    }
    
    return {
      odc: foundOdc,
      branchId,
      routerIndex,
      oltIndex,
      ponPortIndex,
      odcIndex
    };
  } catch (error) {
    console.error(`Error getting ODC with ID ${odcId}:`, error);
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

module.exports = {
  getOdcById,
  addOdpToOdc
}; 