/**
 * Repository untuk operasi pada collection branches terkait net device ODP
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOntEntity } = require('../entities/netDeviceOnt.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Nama collection
const COLLECTION = 'branches';

/**
 * Mencari ODP dan mendapatkan informasi path ke ODP
 * @param {string} odpId - ID ODP
 * @returns {Promise<Object>} - Data ODP dan path informasi
 */
async function getOdpById(odpId) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Mencari branch yang memiliki ODP berdasarkan ID
    const branch = await collection.findOne({
      'children.children.pon_port.children.trays.children._id': new ObjectId(odpId)
    });
    
    if (!branch) {
      return null;
    }
    
    // Informasi path ke ODP
    let foundOdp = null;
    let branchId = branch._id;
    let routerIndex = -1;
    let oltIndex = -1;
    let ponPortIndex = -1;
    let odcIndex = -1;
    let trayIndex = -1;
    let odpIndex = -1;
    
    // Cari ODP dalam struktur bersarang
    outerLoop:
    for (let i = 0; i < branch.children.length; i++) {
      const router = branch.children[i];
      
      for (let j = 0; j < router.children.length; j++) {
        const olt = router.children[j];
        
        for (let k = 0; k < olt.pon_port.length; k++) {
          const ponPort = olt.pon_port[k];
          
          for (let l = 0; l < ponPort.children.length; l++) {
            const odc = ponPort.children[l];
            
            for (let m = 0; m < odc.trays.length; m++) {
              const tray = odc.trays[m];
              
              for (let n = 0; n < tray.children.length; n++) {
                const odp = tray.children[n];
                
                if (odp._id.toString() === odpId && odp.type === 'odp') {
                  foundOdp = odp;
                  routerIndex = i;
                  oltIndex = j;
                  ponPortIndex = k;
                  odcIndex = l;
                  trayIndex = m;
                  odpIndex = n;
                  break outerLoop;
                }
              }
            }
          }
        }
      }
    }
    
    return {
      odp: foundOdp,
      branchId,
      routerIndex,
      oltIndex,
      ponPortIndex,
      odcIndex,
      trayIndex,
      odpIndex
    };
  } catch (error) {
    console.error(`Error getting ODP with ID ${odpId}:`, error);
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
  addOntToOdp
}; 