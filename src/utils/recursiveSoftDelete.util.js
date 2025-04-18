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
 * Melakukan soft delete pada ODC dan semua ODP serta ONT di dalamnya
 * @param {Object} odcInfo - Data ODC yang akan di-soft delete
 * @param {Date} deletedAt - Timestamp untuk soft delete, opsional
 * @returns {Promise<boolean>} - True jika berhasil
 */
async function softDeleteOdc(odcInfo, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteOdc] Mencoba soft delete ODC dengan ID: ${odcInfo.branchId}`);
    
    const collection = getCollection('branches');
    
    // Update ODC dengan menambahkan deleted_at
    const result = await collection.updateOne(
      { _id: new ObjectId(odcInfo.branchId) },
      {
        $set: {
          [`children.${odcInfo.routerIndex}.children.${odcInfo.oltIndex}.pon_port.${odcInfo.ponPortIndex}.children.${odcInfo.odcIndex}.deleted_at`]: deletedAt,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log('[softDeleteOdc] ODC tidak ditemukan');
      return false;
    }

    // Dapatkan data ODC untuk proses ODP
    const branch = await collection.findOne({ _id: new ObjectId(odcInfo.branchId) });
    if (!branch) {
      console.log('[softDeleteOdc] Branch tidak ditemukan');
      return false;
    }

    const odc = branch.children[odcInfo.routerIndex]?.children[odcInfo.oltIndex]?.pon_port[odcInfo.ponPortIndex]?.children[odcInfo.odcIndex];
    if (!odc) {
      console.log('[softDeleteOdc] ODC tidak ditemukan di struktur');
      return false;
    }

    // Proses soft delete untuk setiap ODP yang belum dihapus
    if (odc.trays && Array.isArray(odc.trays)) {
      for (let trayIndex = 0; trayIndex < odc.trays.length; trayIndex++) {
        const tray = odc.trays[trayIndex];
        if (tray.children && Array.isArray(tray.children)) {
          for (let odpIndex = 0; odpIndex < tray.children.length; odpIndex++) {
            const odp = tray.children[odpIndex];
            // Hanya proses ODP yang belum memiliki deleted_at
            if (!odp.deleted_at) {
              await softDeleteOdp({
                branchId: odcInfo.branchId,
                routerIndex: odcInfo.routerIndex,
                oltIndex: odcInfo.oltIndex,
                ponPortIndex: odcInfo.ponPortIndex,
                odcIndex: odcInfo.odcIndex,
                trayIndex,
                odpIndex
              }, deletedAt); // Gunakan timestamp yang sama
            }
          }
        }
      }
    }

    console.log('[softDeleteOdc] ODC dan semua device di bawahnya berhasil di-soft delete');
    return true;
  } catch (error) {
    console.error('Error soft deleting ODC:', error);
    throw error;
  }
}

/**
 * Melakukan soft delete pada OLT dan semua ODC, ODP, serta ONT di dalamnya
 * @param {Object} oltInfo - Informasi OLT yang akan di-soft delete
 * @param {Date} deletedAt - Timestamp untuk soft delete
 * @returns {Promise<boolean>} - True jika berhasil
 */
async function softDeleteOlt(oltInfo, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteOlt] Mencoba soft delete OLT dengan ID: ${oltInfo.branchId}`);
    
    const collection = getCollection('branches');
    
    // Update OLT dengan menambahkan deleted_at
    const result = await collection.updateOne(
      { _id: new ObjectId(oltInfo.branchId) },
      {
        $set: {
          [`children.${oltInfo.routerIndex}.children.${oltInfo.oltIndex}.deleted_at`]: deletedAt,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log('[softDeleteOlt] OLT tidak ditemukan');
      return false;
    }

    // Dapatkan data OLT untuk proses ODC
    const branch = await collection.findOne({ _id: new ObjectId(oltInfo.branchId) });
    if (!branch) {
      console.log('[softDeleteOlt] Branch tidak ditemukan');
      return false;
    }

    const olt = branch.children[oltInfo.routerIndex]?.children[oltInfo.oltIndex];
    if (!olt) {
      console.log('[softDeleteOlt] OLT tidak ditemukan di struktur');
      return false;
    }

    // Proses soft delete untuk setiap ODC di setiap PON port yang belum dihapus
    if (olt.pon_port && Array.isArray(olt.pon_port)) {
      for (let ponPortIndex = 0; ponPortIndex < olt.pon_port.length; ponPortIndex++) {
        const ponPort = olt.pon_port[ponPortIndex];
        if (ponPort.children && Array.isArray(ponPort.children)) {
          for (let odcIndex = 0; odcIndex < ponPort.children.length; odcIndex++) {
            const odc = ponPort.children[odcIndex];
            // Hanya proses ODC yang belum memiliki deleted_at
            if (!odc.deleted_at) {
              const odcResult = await softDeleteOdc({
                branchId: oltInfo.branchId,
                routerIndex: oltInfo.routerIndex,
                oltIndex: oltInfo.oltIndex,
                ponPortIndex,
                odcIndex
              }, deletedAt);

              if (!odcResult) {
                console.log(`[softDeleteOlt] Gagal melakukan soft delete pada ODC di port ${ponPortIndex}`);
                // Lanjutkan ke ODC berikutnya
                continue;
              }
            }
          }
        }
      }
    }

    console.log('[softDeleteOlt] OLT dan semua device di bawahnya berhasil di-soft delete');
    return true;
  } catch (error) {
    console.error('Error soft deleting OLT:', error);
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