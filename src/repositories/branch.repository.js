/**
 * Repository untuk operasi CRUD pada collection branches
 */

const { getCollection } = require('./database.connector');
const { createBranchEntity } = require('../entities/branch.entity');
const { createNetDeviceRouterEntity } = require('../entities/netDeviceRouter.entity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Nama collection
const COLLECTION = 'branches';

// Enum untuk tipe result
const ResultTypes = {
  BRANCHES: 'BRANCHES',
  ROUTERS: 'ROUTERS',
  OLTS: 'OLTS',
  ODCS: 'ODCS',
  ODPS: 'ODPS'
};

/**
 * Mendapatkan semua branches dengan level detail tertentu
 * @param {string} resultType - Tipe hasil (BRANCHES, ROUTERS, OLTS, ODCS, ODPS)
 * @returns {Promise<Array>} - Array berisi data branches sesuai level detail
 */
async function getAllBranches(resultType = null) {
  try {
    const collection = getCollection(COLLECTION);
    const branches = await collection.find({}).toArray();
    
    // Jika resultType tidak dispesifikasikan, kembalikan data lengkap seperti biasa
    if (!resultType || !Object.values(ResultTypes).includes(resultType)) {
      return branches.map(branch => createBranchEntity(branch));
    }
    
    // Filter data sesuai resultType
    return branches.map(branch => {
      const branchCopy = { ...branch };
      
      // BRANCHES: Hapus children dari branch
      if (resultType === ResultTypes.BRANCHES) {
        delete branchCopy.children;
        return branchCopy;
      }
      
      // Jika tidak ada children, kembalikan branch apa adanya
      if (!branchCopy.children || !Array.isArray(branchCopy.children)) {
        return branchCopy;
      }
      
      // ROUTERS: Pertahankan children (router) tapi hapus children dari router
      if (resultType === ResultTypes.ROUTERS) {
        branchCopy.children = branchCopy.children.map(router => {
          const routerCopy = { ...router };
          delete routerCopy.children;
          return routerCopy;
        });
        return branchCopy;
      }
      
      // OLTS: Pertahankan router dan OLT dengan pon_port, tapi hapus children dari setiap port di pon_port
      if (resultType === ResultTypes.OLTS) {
        branchCopy.children = branchCopy.children.map(router => {
          const routerCopy = { ...router };
          
          if (routerCopy.children && Array.isArray(routerCopy.children)) {
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
          }
          
          return routerCopy;
        });
        return branchCopy;
      }
      
      // ODCS: Pertahankan router, OLT, dan ODC dengan trays, tapi hapus children dari setiap tray
      if (resultType === ResultTypes.ODCS) {
        branchCopy.children = branchCopy.children.map(router => {
          const routerCopy = { ...router };
          
          if (routerCopy.children && Array.isArray(routerCopy.children)) {
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
          }
          
          return routerCopy;
        });
        return branchCopy;
      }
      
      // ODPS: Pertahankan router, OLT, ODC, dan ODP tapi hapus children dari ODP
      if (resultType === ResultTypes.ODPS) {
        branchCopy.children = branchCopy.children.map(router => {
          const routerCopy = { ...router };
          
          if (routerCopy.children && Array.isArray(routerCopy.children)) {
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
          }
          
          return routerCopy;
        });
        return branchCopy;
      }
      
      return branchCopy;
    });
  } catch (error) {
    console.error('Error getting branches:', error);
    throw error;
  }
}

/**
 * Mendapatkan branch berdasarkan ID dengan level detail tertentu
 * @param {string} id - ID branch
 * @param {string} resultType - Tipe hasil (BRANCHES, ROUTERS, OLTS, ODCS, ODPS)
 * @returns {Promise<Object>} - Data branch sesuai level detail
 */
async function getBranchById(id, resultType = null) {
  try {
    const collection = getCollection(COLLECTION);
    const branch = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!branch) {
      return null;
    }
    
    // Jika resultType tidak dispesifikasikan, kembalikan data lengkap seperti biasa
    if (!resultType || !Object.values(ResultTypes).includes(resultType)) {
      return createBranchEntity(branch);
    }
    
    // Filter data sesuai resultType
    const branchCopy = { ...branch };
    
    // BRANCHES: Hapus children dari branch
    if (resultType === ResultTypes.BRANCHES) {
      delete branchCopy.children;
      return branchCopy;
    }
    
    // Jika tidak ada children, kembalikan branch apa adanya
    if (!branchCopy.children || !Array.isArray(branchCopy.children)) {
      return branchCopy;
    }
    
    // ROUTERS: Pertahankan children (router) tapi hapus children dari router
    if (resultType === ResultTypes.ROUTERS) {
      branchCopy.children = branchCopy.children.map(router => {
        const routerCopy = { ...router };
        delete routerCopy.children;
        return routerCopy;
      });
      return branchCopy;
    }
    
    // OLTS: Pertahankan router dan OLT dengan pon_port, tapi hapus children dari setiap port di pon_port
    if (resultType === ResultTypes.OLTS) {
      branchCopy.children = branchCopy.children.map(router => {
        const routerCopy = { ...router };
        
        if (routerCopy.children && Array.isArray(routerCopy.children)) {
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
        }
        
        return routerCopy;
      });
      return branchCopy;
    }
    
    // ODCS: Pertahankan router, OLT, dan ODC dengan trays, tapi hapus children dari setiap tray
    if (resultType === ResultTypes.ODCS) {
      branchCopy.children = branchCopy.children.map(router => {
        const routerCopy = { ...router };
        
        if (routerCopy.children && Array.isArray(routerCopy.children)) {
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
        }
        
        return routerCopy;
      });
      return branchCopy;
    }
    
    // ODPS: Pertahankan router, OLT, ODC, dan ODP tapi hapus children dari ODP
    if (resultType === ResultTypes.ODPS) {
      branchCopy.children = branchCopy.children.map(router => {
        const routerCopy = { ...router };
        
        if (routerCopy.children && Array.isArray(routerCopy.children)) {
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
        }
        
        return routerCopy;
      });
      return branchCopy;
    }
    
    return branchCopy;
  } catch (error) {
    console.error(`Error getting branch with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Membuat branch baru
 * @param {Object} branchData - Data branch yang akan dibuat
 * @returns {Promise<Object>} - Data branch yang sudah dibuat
 */
async function createBranch(branchData) {
  try {
    const collection = getCollection(COLLECTION);
    const branch = createBranchEntity(branchData);
    const result = await collection.insertOne(branch);
    return { ...branch, _id: result.insertedId };
  } catch (error) {
    console.error('Error creating branch:', error);
    throw error;
  }
}

/**
 * Mengupdate branch berdasarkan ID
 * @param {string} id - ID branch
 * @param {Object} branchData - Data branch yang akan diupdate
 * @returns {Promise<Object>} - Data branch yang sudah diupdate
 */
async function updateBranch(id, branchData) {
  try {
    const collection = getCollection(COLLECTION);
    const branch = createBranchEntity(branchData);
    delete branch._id; // Hapus _id agar tidak diupdate
    
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: branch }
    );
    
    // Panggil getBranchById tanpa parameter result untuk mendapatkan data lengkap
    return getBranchById(id, null);
  } catch (error) {
    console.error(`Error updating branch with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Menghapus branch berdasarkan ID
 * @param {string} id - ID branch
 * @returns {Promise<boolean>} - True jika berhasil dihapus
 */
async function deleteBranch(id) {
  try {
    const collection = getCollection(COLLECTION);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting branch with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Menambahkan router ke branch berdasarkan ID branch
 * @param {string} id - ID branch
 * @param {Object} routerData - Data router yang akan ditambahkan
 * @returns {Promise<Object>} - Data branch yang sudah diupdate dengan router baru
 */
async function addRouterToBranch(id, routerData) {
  try {
    const collection = getCollection(COLLECTION);
    
    // Buat entity router dengan ObjectId baru
    const routerId = new ObjectId();
    const router = createNetDeviceRouterEntity({
      ...routerData,
      _id: routerId
    });
    
    // Update branch, tambahkan router ke children
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $push: { children: router },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    // Panggil getBranchById tanpa parameter result untuk mendapatkan data lengkap
    return getBranchById(id, null);
  } catch (error) {
    console.error(`Error adding router to branch with ID ${id}:`, error);
    throw error;
  }
}

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  addRouterToBranch,
  ResultTypes
};
