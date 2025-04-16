/**
 * Repository untuk operasi pada collection branches terkait net device ONT
 */

const { getCollection } = require('./database.connector');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Nama collection
const COLLECTION = 'branches';

/**
 * Mencari ONT dan mendapatkan informasi path ke ONT
 * @param {string} ontId - ID ONT
 * @returns {Promise<Object>} - Data ONT
 */
async function getOntById(ontId) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Mencari branch yang memiliki ONT berdasarkan ID
    const branch = await collection.findOne({
      'children.children.pon_port.children.trays.children.children._id': new ObjectId(ontId)
    });
    
    if (!branch) {
      return null;
    }
    
    // Informasi path ke ONT
    let foundOnt = null;
    
    // Cari ONT dalam struktur bersarang
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
                
                for (let o = 0; o < odp.children.length; o++) {
                  const ont = odp.children[o];
                  
                  if (ont._id.toString() === ontId && ont.type === 'ont') {
                    foundOnt = ont;
                    break outerLoop;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return foundOnt;
  } catch (error) {
    console.error(`Error getting ONT with ID ${ontId}:`, error);
    throw error;
  }
}

module.exports = {
  getOntById
}; 