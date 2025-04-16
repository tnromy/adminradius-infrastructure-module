/**
 * Repository untuk operasi pada collection branches terkait net device router
 */

const { getCollection } = require('./database.connector');
const { createNetDeviceOltEntity } = require('../entities/netDeviceOlt.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe result
const ResultTypes = {
  ROUTERS: 'ROUTERS',
  OLTS: 'OLTS',
  ODCS: 'ODCS',
  ODPS: 'ODPS'
};

/**
 * Mendapatkan router berdasarkan ID dengan level detail tertentu
 * @param {string} routerId - ID router
 * @param {string} resultType - Tipe hasil (ROUTERS, OLTS, ODCS, ODPS)
 * @returns {Promise<Object>} - Data router sesuai level detail
 */
async function getRouterById(routerId, resultType = null) {
  try {
    const collection = getCollection(COLLECTION);
    // Mencari branch yang memiliki router dengan ID tertentu di dalam children
    const branch = await collection.findOne({
      'children._id': new ObjectId(routerId)
    });
    
    if (!branch) {
      return null;
    }
    
    // Cari router dalam array children
    const router = branch.children.find(child => 
      child._id.toString() === routerId && child.type === 'router'
    );
    
    if (!router) {
      return null;
    }
    
    // Jika resultType tidak dispesifikasikan, kembalikan data lengkap seperti biasa
    if (!resultType || !Object.values(ResultTypes).includes(resultType)) {
      return router;
    }
    
    // Filter data sesuai resultType
    const routerCopy = { ...router };
    
    // ROUTERS: Hapus children dari router
    if (resultType === ResultTypes.ROUTERS) {
      delete routerCopy.children;
      return routerCopy;
    }
    
    // Jika tidak ada children, kembalikan router apa adanya
    if (!routerCopy.children || !Array.isArray(routerCopy.children)) {
      return routerCopy;
    }
    
    // OLTS: Pertahankan OLT dengan pon_port, tapi hapus children dari setiap port di pon_port
    if (resultType === ResultTypes.OLTS) {
      routerCopy.children = routerCopy.children.map(olt => {
        const oltCopy = { ...olt };
        
        // Tetap menyertakan pon_port tapi hapus children dari setiap port
        if (oltCopy.pon_port && Array.isArray(oltCopy.pon_port)) {
          oltCopy.pon_port = oltCopy.pon_port.map(port => {
            const portCopy = { ...port };
            delete portCopy.children;
            return portCopy;
          });
        }
        
        return oltCopy;
      });
      return routerCopy;
    }
    
    // ODCS: Pertahankan OLT dan ODC dengan trays, tapi hapus children dari setiap tray
    if (resultType === ResultTypes.ODCS) {
      routerCopy.children = routerCopy.children.map(olt => {
        const oltCopy = { ...olt };
        
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
        
        return oltCopy;
      });
      return routerCopy;
    }
    
    // ODPS: Pertahankan OLT, ODC, dan ODP tapi hapus children dari ODP
    if (resultType === ResultTypes.ODPS) {
      routerCopy.children = routerCopy.children.map(olt => {
        const oltCopy = { ...olt };
        
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
        
        return oltCopy;
      });
      return routerCopy;
    }
    
    return routerCopy;
  } catch (error) {
    console.error(`Error getting router with ID ${routerId}:`, error);
    throw error;
  }
}

/**
 * Menambahkan OLT ke router berdasarkan ID router
 * @param {string} routerId - ID router
 * @param {Object} oltData - Data OLT yang akan ditambahkan
 * @returns {Promise<Object>} - Data branch yang sudah diupdate dengan OLT baru di router
 */
async function addOltToRouter(routerId, oltData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Jika ada available_pon, buat array pon_port
    if (oltData.available_pon && typeof oltData.available_pon === 'number') {
      const ponPorts = [];
      for (let i = 1; i <= oltData.available_pon; i++) {
        ponPorts.push({
          port: i,
          max_client: 64, // Nilai default untuk max_client
          children: []
        });
      }
      oltData.pon_port = ponPorts;
      // Hapus available_pon karena tidak diperlukan lagi
      delete oltData.available_pon;
    }
    
    // Buat entity OLT dengan ObjectId baru
    const oltId = new ObjectId();
    const olt = createNetDeviceOltEntity({
      ...oltData,
      _id: oltId
    });
    
    // Update branch, tambahkan OLT ke router.children
    const result = await collection.updateOne(
      { 'children._id': new ObjectId(routerId) },
      { 
        $push: { 'children.$.children': olt },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Dapatkan router yang sudah diupdate
    return getRouterById(routerId, null);
  } catch (error) {
    console.error(`Error adding OLT to router with ID ${routerId}:`, error);
    throw error;
  }
}

module.exports = {
  getRouterById,
  addOltToRouter,
  ResultTypes
}; 