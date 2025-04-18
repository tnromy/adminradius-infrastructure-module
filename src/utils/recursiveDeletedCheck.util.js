/**
 * Utility untuk melakukan pemeriksaan deleted_at secara recursive
 */

const DeletedFilterTypes = {
  ONLY: 'ONLY',    // Hanya data yang dihapus (memiliki deleted_at)
  WITH: 'WITH',    // Semua data, termasuk yang dihapus
  WITHOUT: 'WITHOUT' // Hanya data yang tidak dihapus (default)
};

/**
 * Memeriksa apakah sebuah object memenuhi kriteria filter deleted
 * @param {Object} obj - Object yang akan diperiksa
 * @param {string} deletedFilter - Tipe filter yang digunakan (ONLY, WITH, WITHOUT)
 * @returns {boolean} - True jika object memenuhi kriteria
 */
function isMatchingDeletedFilter(obj, deletedFilter) {
  if (deletedFilter === DeletedFilterTypes.WITH) return true;
  if (deletedFilter === DeletedFilterTypes.ONLY) return obj.deleted_at !== undefined;
  if (deletedFilter === DeletedFilterTypes.WITHOUT) return obj.deleted_at === undefined;
  return false;
}

/**
 * Memeriksa dan memfilter children dari pon_port OLT
 * @param {Array} ponPorts - Array port dari OLT
 * @param {string} deletedFilter - Tipe filter yang digunakan
 * @param {string} scopeLevel - Level scope data yang akan dikembalikan
 * @returns {Array} - Array port yang sudah difilter
 */
function checkPonPorts(ponPorts, deletedFilter, scopeLevel) {
  if (!ponPorts || !Array.isArray(ponPorts)) return [];
  
  return ponPorts
    .map(port => {
      const portCopy = { ...port };
      
      if (portCopy.children && Array.isArray(portCopy.children)) {
        // Filter ODC di children
        portCopy.children = portCopy.children
          .filter(odc => isMatchingDeletedFilter(odc, deletedFilter))
          .map(odc => {
            const odcCopy = { ...odc };
            
            if (odcCopy.trays && Array.isArray(odcCopy.trays)) {
              // Filter ODP di trays
              odcCopy.trays = odcCopy.trays
                .map(tray => {
                  const trayCopy = { ...tray };
                  
                  // Jika scopeLevel adalah ODCS, hapus children dari tray (yang berisi ODP)
                  if (scopeLevel === 'ODCS') {
                    delete trayCopy.children;
                    return trayCopy;
                  }
                  
                  if (trayCopy.children && Array.isArray(trayCopy.children)) {
                    // Filter ODP
                    trayCopy.children = trayCopy.children
                      .filter(odp => isMatchingDeletedFilter(odp, deletedFilter))
                      .map(odp => {
                        const odpCopy = { ...odp };
                        
                        // Jika scopeLevel adalah ODPS, hapus children (ONT)
                        if (scopeLevel === 'ODPS') {
                          delete odpCopy.children;
                          return odpCopy;
                        }
                        
                        if (odpCopy.children && Array.isArray(odpCopy.children)) {
                          // Filter ONT
                          odpCopy.children = odpCopy.children
                            .filter(ont => isMatchingDeletedFilter(ont, deletedFilter));
                        }
                        
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

/**
 * Melakukan pemeriksaan deleted_at secara recursive pada branch dan children-nya
 * @param {Object} branch - Data branch yang akan diperiksa
 * @param {string} deletedFilter - Tipe filter yang digunakan (ONLY, WITH, WITHOUT)
 * @param {string} scopeLevel - Level scope data yang akan dikembalikan
 * @returns {Object|null} - Branch yang sudah difilter atau null jika tidak memenuhi kriteria
 */
function recursiveDeletedCheck(branch, deletedFilter = DeletedFilterTypes.WITHOUT, scopeLevel = null) {
  // Periksa apakah branch memenuhi kriteria filter
  if (!isMatchingDeletedFilter(branch, deletedFilter)) {
    return null;
  }
  
  const branchCopy = { ...branch };
  
  // Jika tidak ada children atau scopeLevel adalah BRANCHES, return early
  if (!branchCopy.children || !Array.isArray(branchCopy.children) || scopeLevel === 'BRANCHES') {
    delete branchCopy.children;
    return branchCopy;
  }
  
  // Filter dan map router
  branchCopy.children = branchCopy.children
    .filter(router => isMatchingDeletedFilter(router, deletedFilter))
    .map(router => {
      const routerCopy = { ...router };
      
      // Jika scopeLevel adalah ROUTERS, hapus children router
      if (scopeLevel === 'ROUTERS') {
        delete routerCopy.children;
        return routerCopy;
      }
      
      if (routerCopy.children && Array.isArray(routerCopy.children)) {
        // Filter dan map OLT
        routerCopy.children = routerCopy.children
          .filter(olt => isMatchingDeletedFilter(olt, deletedFilter))
          .map(olt => {
            const oltCopy = { ...olt };
            
            // Jika scopeLevel adalah OLTS, hapus children dari pon_port
            if (scopeLevel === 'OLTS') {
              if (oltCopy.pon_port && Array.isArray(oltCopy.pon_port)) {
                oltCopy.pon_port = oltCopy.pon_port.map(port => {
                  const portCopy = { ...port };
                  delete portCopy.children;
                  return portCopy;
                });
              }
              return oltCopy;
            }
            
            // Proses pon_port dan children-nya (ODC, ODP, ONT)
            if (oltCopy.pon_port && Array.isArray(oltCopy.pon_port)) {
              oltCopy.pon_port = checkPonPorts(oltCopy.pon_port, deletedFilter, scopeLevel);
            }
            
            return oltCopy;
          });
      }
      
      return routerCopy;
    });
  
  return branchCopy;
}

module.exports = {
  recursiveDeletedCheck,
  DeletedFilterTypes
}; 