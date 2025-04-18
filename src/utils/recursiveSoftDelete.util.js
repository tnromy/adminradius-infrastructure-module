/**
 * Utilitas untuk melakukan soft delete secara rekursif pada perangkat jaringan
 */

const { getCollection } = require('../repositories/database.connector');
const { ObjectId } = require('mongoose').Types;

/**
 * Helper untuk membuat path update berdasarkan indeks dalam nested document
 * @param {string} device - Jenis perangkat (router, olt, odc, odp, ont)
 * @param {Object} indexes - Indeks untuk setiap level hierarki
 * @returns {string} - Path update untuk MongoDB
 */
function buildDevicePath(device, indexes) {
  const { routerIndex, oltIndex, ponPortIndex, odcIndex, trayIndex, odpIndex, ontIndex } = indexes;
  
  switch (device) {
    case 'router':
      return `children.${routerIndex}`;
    case 'olt':
      return `children.${routerIndex}.children.${oltIndex}`;
    case 'odc':
      return `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}`;
    case 'odp':
      return `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}`;
    case 'ont':
      return `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.children.${ontIndex}`;
    default:
      throw new Error(`Jenis perangkat tidak didukung: ${device}`);
  }
}

/**
 * Melakukan soft delete pada ONT
 * @param {Object} ontData - Data ONT yang akan di-soft delete (berisi branchId dan semua indeks)
 * @returns {Promise<Object>} - Hasil update
 */
async function softDeleteOnt(ontData) {
  const { branchId, routerIndex, oltIndex, ponPortIndex, odcIndex, trayIndex, odpIndex, ontIndex } = ontData;
  
  const collection = getCollection('branches');
  const ontPath = buildDevicePath('ont', ontData);
  
  // Update ONT dengan deleted_at jika belum ada
  const updateResult = await collection.updateOne(
    { 
      _id: new ObjectId(branchId), 
      [`${ontPath}.deleted_at`]: { $exists: false } 
    },
    { 
      $set: { 
        [`${ontPath}.deleted_at`]: new Date(),
        updatedAt: new Date()
      } 
    }
  );
  
  return updateResult;
}

/**
 * Melakukan soft delete pada ODP dan semua ONT di dalamnya
 * @param {Object} odpInfo - Informasi ODP yang akan di-soft delete
 * @param {Date} [deletedAt] - Timestamp untuk deleted_at yang akan digunakan
 * @returns {Promise<boolean>} - True jika berhasil di-soft delete
 */
async function softDeleteOdp(odpInfo, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteOdp] Mencoba soft delete ODP dengan timestamp: ${deletedAt.toISOString()}`);
    const collection = getCollection('branches');
    
    const {
      branchId,
      routerIndex,
      oltIndex,
      ponPortIndex,
      odcIndex,
      trayIndex,
      odpIndex
    } = odpInfo;
    
    // 1. Soft delete ODP
    const odpResult = await collection.updateOne(
      { 
        _id: branchId,
        [`children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.deleted_at`]: { $exists: false }
      },
      {
        $set: {
          [`children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.deleted_at`]: deletedAt,
          updatedAt: new Date()
        }
      }
    );
    
    if (odpResult.modifiedCount === 0) {
      console.log('[softDeleteOdp] ODP sudah memiliki deleted_at atau tidak ditemukan');
      return false;
    }
    
    // 2. Dapatkan data ODP untuk soft delete ONTs
    const branch = await collection.findOne({ _id: branchId });
    if (!branch) {
      console.log('[softDeleteOdp] Branch tidak ditemukan setelah update ODP');
      return false;
    }
    
    const odp = branch.children[routerIndex]
      ?.children[oltIndex]
      ?.pon_port[ponPortIndex]
      ?.children[odcIndex]
      ?.trays[trayIndex]
      ?.children[odpIndex];
    
    if (!odp) {
      console.log('[softDeleteOdp] ODP tidak ditemukan dalam struktur setelah update');
      return false;
    }
    
    // 3. Soft delete hanya ONT yang belum memiliki deleted_at
    if (odp.children && Array.isArray(odp.children)) {
      const ontsToUpdate = odp.children
        .map((ont, idx) => ({ ont, idx }))
        .filter(({ ont }) => !ont.deleted_at);
      
      console.log(`[softDeleteOdp] Ditemukan ${ontsToUpdate.length} ONT yang belum memiliki deleted_at dari total ${odp.children.length} ONT`);
      
      if (ontsToUpdate.length > 0) {
        const ontUpdates = ontsToUpdate.map(({ idx }) => {
          return collection.updateOne(
            { 
              _id: branchId,
              [`children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.children.${idx}.deleted_at`]: { $exists: false }
            },
            {
              $set: {
                [`children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.children.${idx}.deleted_at`]: deletedAt,
                updatedAt: new Date()
              }
            }
          );
        });
        
        console.log(`[softDeleteOdp] Melakukan soft delete pada ${ontUpdates.length} ONT yang belum memiliki deleted_at`);
        await Promise.all(ontUpdates);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in softDeleteOdp:', error);
    throw error;
  }
}

/**
 * Melakukan soft delete pada ODC dan semua ODP dan ONT di dalamnya
 * @param {Object} odcData - Data ODC yang akan di-soft delete (berisi branchId dan semua indeks)
 * @returns {Promise<Object>} - Hasil update
 */
async function softDeleteOdc(odcData) {
  try {
    const { branchId, routerIndex, oltIndex, ponPortIndex, odcIndex } = odcData;
    
    const collection = getCollection('branches');
    const odcPath = buildDevicePath('odc', odcData);
    
    // 1. Update ODC dengan deleted_at jika belum ada
    const updateResult = await collection.updateOne(
      { 
        _id: new ObjectId(branchId), 
        [`${odcPath}.deleted_at`]: { $exists: false } 
      },
      { 
        $set: { 
          [`${odcPath}.deleted_at`]: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    if (updateResult.matchedCount === 0) {
      console.log('ODC not found or already has deleted_at property');
    }
    
    // 2. Update semua ODP dalam trays ODC yang belum memiliki deleted_at
    // Karena struktur bersarang, ini harus dilakukan untuk setiap tray
    // Dapatkan data branch untuk memproses trays
    const branch = await collection.findOne({ _id: new ObjectId(branchId) });
    
    if (!branch) {
      console.error('Branch not found with ID:', branchId);
      return { success: true, message: 'ODC marked as deleted, but branch not found for recursive delete' };
    }
    
    // Validasi struktur data dan navigasikan ke ODC
    if (!branch.children || !Array.isArray(branch.children) || 
        routerIndex < 0 || routerIndex >= branch.children.length) {
      console.error('Invalid router index or children structure:', { routerIndex, hasChildren: !!branch.children });
      return { success: true, message: 'ODC marked as deleted, but cannot find router for recursive delete' };
    }
    
    const router = branch.children[routerIndex];
    if (!router || !router.children || !Array.isArray(router.children) || 
        oltIndex < 0 || oltIndex >= router.children.length) {
      console.error('Invalid OLT index or router children structure:', { oltIndex, hasChildren: !!(router && router.children) });
      return { success: true, message: 'ODC marked as deleted, but cannot find OLT for recursive delete' };
    }
    
    const olt = router.children[oltIndex];
    if (!olt || !olt.pon_port || !Array.isArray(olt.pon_port) || 
        ponPortIndex < 0 || ponPortIndex >= olt.pon_port.length) {
      console.error('Invalid pon_port index or pon_port structure:', 
                    { ponPortIndex, hasPort: !!(olt && olt.pon_port), isArray: !!(olt && Array.isArray(olt.pon_port)) });
      return { success: true, message: 'ODC marked as deleted, but cannot find pon_port for recursive delete' };
    }
    
    const ponPort = olt.pon_port[ponPortIndex];
    if (!ponPort || !ponPort.children || !Array.isArray(ponPort.children) || 
        odcIndex < 0 || odcIndex >= ponPort.children.length) {
      console.error('Invalid ODC index or ponPort.children structure:', 
                    { odcIndex, hasChildren: !!(ponPort && ponPort.children), isArray: !!(ponPort && Array.isArray(ponPort.children)) });
      return { success: true, message: 'ODC marked as deleted, but cannot find ODC for recursive delete' };
    }
    
    const odc = ponPort.children[odcIndex];
    if (!odc) {
      console.error('ODC not found at specified indices');
      return { success: true, message: 'ODC marked as deleted, but ODC object not found for recursive delete' };
    }
    
    if (!odc.trays || !Array.isArray(odc.trays)) {
      console.error('ODC does not have trays or trays is not an array:', { hasTrays: !!odc.trays, isArray: Array.isArray(odc.trays) });
      return { success: true, message: 'ODC marked as deleted, but has no trays for recursive delete' };
    }
    
    // Lakukan update untuk setiap tray dan ODP di dalamnya
    for (let trayIndex = 0; trayIndex < odc.trays.length; trayIndex++) {
      const tray = odc.trays[trayIndex];
      
      if (!tray) {
        console.log(`Skipping null/undefined tray at index ${trayIndex}`);
        continue;
      }
      
      if (!tray.children || !Array.isArray(tray.children)) {
        console.log(`Skipping tray at index ${trayIndex} with no children array`);
        continue;
      }
      
      for (let odpIndex = 0; odpIndex < tray.children.length; odpIndex++) {
        const odp = tray.children[odpIndex];
        
        if (!odp) {
          console.log(`Skipping null/undefined ODP at tray ${trayIndex}, index ${odpIndex}`);
          continue;
        }
        
        // Soft delete ODP jika belum di-delete
        if (!odp.deleted_at) {
          try {
            await softDeleteOdp({
              branchId, routerIndex, oltIndex, ponPortIndex, odcIndex, trayIndex, odpIndex
            });
          } catch (odpError) {
            console.error(`Error soft deleting ODP at tray ${trayIndex}, index ${odpIndex}:`, odpError);
            // Lanjutkan proses meskipun ada error pada satu ODP
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in softDeleteOdc:', error);
    throw error;
  }
}

/**
 * Melakukan soft delete pada OLT dan semua ODC, ODP, dan ONT di dalamnya
 * @param {Object} oltData - Data OLT yang akan di-soft delete (berisi branchId dan semua indeks)
 * @returns {Promise<Object>} - Hasil update
 */
async function softDeleteOlt(oltData) {
  try {
    const { branchId, routerIndex, oltIndex } = oltData;
    
    const collection = getCollection('branches');
    const oltPath = buildDevicePath('olt', oltData);
    
    // 1. Update OLT dengan deleted_at jika belum ada
    const updateResult = await collection.updateOne(
      { 
        _id: new ObjectId(branchId), 
        [`${oltPath}.deleted_at`]: { $exists: false } 
      },
      { 
        $set: { 
          [`${oltPath}.deleted_at`]: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    if (updateResult.matchedCount === 0) {
      console.log('OLT not found or already has deleted_at property');
    }
    
    // 2. Dapatkan data branch untuk memproses pon_ports dan ODCs
    const branch = await collection.findOne({ _id: new ObjectId(branchId) });
    
    if (!branch) {
      console.error('Branch not found with ID:', branchId);
      return { success: true, message: 'OLT marked as deleted, but branch not found for recursive delete' };
    }
    
    // 3. Navigasikan ke OLT dengan penanganan error yang lebih baik
    if (!branch.children || !Array.isArray(branch.children) || routerIndex < 0 || routerIndex >= branch.children.length) {
      console.error('Invalid router index or children structure:', { routerIndex, hasChildren: !!branch.children });
      return { success: true, message: 'OLT marked as deleted, but cannot find router for recursive delete' };
    }
    
    const router = branch.children[routerIndex];
    if (!router || !router.children || !Array.isArray(router.children) || 
        oltIndex < 0 || oltIndex >= router.children.length) {
      console.error('Invalid OLT index or router children structure:', { oltIndex, hasChildren: !!(router && router.children) });
      return { success: true, message: 'OLT marked as deleted, but cannot find OLT for recursive delete' };
    }
    
    const olt = router.children[oltIndex];
    if (!olt) {
      console.error('OLT not found at specified index:', oltIndex);
      return { success: true, message: 'OLT marked as deleted, but OLT object not found for recursive delete' };
    }
    
    // 4. Periksa apakah pon_port ada dan merupakan array
    if (!olt.pon_port || !Array.isArray(olt.pon_port)) {
      console.error('OLT does not have pon_port or pon_port is not an array:', { hasPort: !!olt.pon_port, isArray: Array.isArray(olt.pon_port) });
      return { success: true, message: 'OLT marked as deleted, but has no pon_ports for recursive delete' };
    }
    
    // 5. Lakukan update untuk setiap pon_port dan ODC di dalamnya
    for (let ponPortIndex = 0; ponPortIndex < olt.pon_port.length; ponPortIndex++) {
      const ponPort = olt.pon_port[ponPortIndex];
      
      if (!ponPort) {
        console.log(`Skipping null/undefined pon_port at index ${ponPortIndex}`);
        continue;
      }
      
      if (!ponPort.children || !Array.isArray(ponPort.children)) {
        console.log(`Skipping pon_port at index ${ponPortIndex} with no children array`);
        continue;
      }
      
      for (let odcIndex = 0; odcIndex < ponPort.children.length; odcIndex++) {
        const odc = ponPort.children[odcIndex];
        
        if (!odc) {
          console.log(`Skipping null/undefined ODC at pon_port ${ponPortIndex}, index ${odcIndex}`);
          continue;
        }
        
        // Soft delete ODC jika belum di-delete
        if (!odc.deleted_at) {
          try {
            await softDeleteOdc({
              branchId, routerIndex, oltIndex, ponPortIndex, odcIndex
            });
          } catch (odcError) {
            console.error(`Error soft deleting ODC at pon_port ${ponPortIndex}, index ${odcIndex}:`, odcError);
            // Lanjutkan proses meskipun ada error pada satu ODC
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in softDeleteOlt:', error);
    throw error;
  }
}

/**
 * Melakukan soft delete pada Router dan semua OLT, ODC, ODP, dan ONT di dalamnya
 * @param {Object} routerData - Data Router yang akan di-soft delete (berisi branchId dan indeks router)
 * @returns {Promise<Object>} - Hasil update
 */
async function softDeleteRouter(routerData) {
  const { branchId, routerIndex } = routerData;
  
  const collection = getCollection('branches');
  const routerPath = buildDevicePath('router', routerData);
  
  // 1. Update Router dengan deleted_at jika belum ada
  await collection.updateOne(
    { 
      _id: new ObjectId(branchId), 
      [`${routerPath}.deleted_at`]: { $exists: false } 
    },
    { 
      $set: { 
        [`${routerPath}.deleted_at`]: new Date(),
        updatedAt: new Date()
      } 
    }
  );
  
  // 2. Dapatkan data branch untuk memproses OLTs
  const branch = await collection.findOne({ _id: new ObjectId(branchId) });
  
  if (!branch) return null;
  
  // Navigasikan ke Router
  let router;
  try {
    router = branch.children[routerIndex];
  } catch (error) {
    return null;
  }
  
  if (!router || !router.children) return null;
  
  // Lakukan update untuk setiap OLT di dalamnya
  for (let oltIndex = 0; oltIndex < router.children.length; oltIndex++) {
    const olt = router.children[oltIndex];
    
    if (!olt) continue;
    
    // Soft delete OLT jika belum di-delete
    if (!olt.deleted_at) {
      await softDeleteOlt({
        branchId, routerIndex, oltIndex
      });
    }
  }
  
  return { success: true };
}

/**
 * Melakukan soft delete pada Branch dan semua Router, OLT, ODC, ODP, dan ONT di dalamnya
 * @param {string} branchId - ID Branch yang akan di-soft delete
 * @returns {Promise<Object>} - Hasil update
 */
async function softDeleteBranch(branchId) {
  const collection = getCollection('branches');
  
  // 1. Update Branch dengan deleted_at jika belum ada
  await collection.updateOne(
    { 
      _id: new ObjectId(branchId), 
      deleted_at: { $exists: false } 
    },
    { 
      $set: { 
        deleted_at: new Date(),
        updatedAt: new Date()
      } 
    }
  );
  
  // 2. Dapatkan data branch untuk memproses Routers
  const branch = await collection.findOne({ _id: new ObjectId(branchId) });
  
  if (!branch) return null;
  
  if (!branch.children) return { success: true };
  
  // Lakukan update untuk setiap Router di dalamnya
  for (let routerIndex = 0; routerIndex < branch.children.length; routerIndex++) {
    const router = branch.children[routerIndex];
    
    if (!router) continue;
    
    // Soft delete Router jika belum di-delete
    if (!router.deleted_at) {
      await softDeleteRouter({
        branchId, routerIndex
      });
    }
  }
  
  return { success: true };
}

module.exports = {
  softDeleteOnt,
  softDeleteOdp,
  softDeleteOdc,
  softDeleteOlt,
  softDeleteRouter,
  softDeleteBranch
}; 