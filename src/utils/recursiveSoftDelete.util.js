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
 * @param {Object} ontData - Data ONT yang akan di-soft delete
 * @param {Date} deletedAt - Timestamp untuk soft delete (opsional)
 * @returns {Promise<boolean>} - True jika berhasil
 */
async function softDeleteOnt(ontData, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteOnt] Mencoba soft delete ONT di branch ${ontData.branchId}`);
    const collection = getCollection('branches');
    
    // Update ONT dengan menambahkan deleted_at
    const result = await collection.updateOne(
      { _id: new ObjectId(ontData.branchId) },
      {
        $set: {
          [`children.${ontData.routerIndex}.children.${ontData.oltIndex}.pon_port.${ontData.ponPortIndex}.children.${ontData.odcIndex}.trays.${ontData.trayIndex}.children.${ontData.odpIndex}.children.${ontData.ontIndex}.deleted_at`]: deletedAt,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log('[softDeleteOnt] ONT tidak ditemukan');
      return false;
    }

    console.log('[softDeleteOnt] ONT berhasil di-soft delete');
    return true;
  } catch (error) {
    console.error('Error soft deleting ONT:', error);
    throw error;
  }
}

/**
 * Melakukan soft delete pada ODP dan semua ONT di dalamnya
 * @param {Object} odpInfo - Informasi ODP yang akan di-soft delete
 * @param {Date} deletedAt - Timestamp untuk soft delete (opsional)
 * @returns {Promise<boolean>} - True jika berhasil
 */
async function softDeleteOdp(odpInfo, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteOdp] Mencoba soft delete ODP di branch ${odpInfo.branchId}`);
    const collection = getCollection('branches');
    
    // Update ODP dengan menambahkan deleted_at
    const result = await collection.updateOne(
      { _id: new ObjectId(odpInfo.branchId) },
      {
        $set: {
          [`children.${odpInfo.routerIndex}.children.${odpInfo.oltIndex}.pon_port.${odpInfo.ponPortIndex}.children.${odpInfo.odcIndex}.trays.${odpInfo.trayIndex}.children.${odpInfo.odpIndex}.deleted_at`]: deletedAt,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log('[softDeleteOdp] ODP tidak ditemukan');
      return false;
    }

    // Dapatkan data ODP untuk proses ONT
    const branch = await collection.findOne({ _id: new ObjectId(odpInfo.branchId) });
    if (!branch) {
      console.log('[softDeleteOdp] Branch tidak ditemukan');
      return false;
    }

    const odp = branch.children[odpInfo.routerIndex]?.children[odpInfo.oltIndex]?.pon_port[odpInfo.ponPortIndex]?.children[odpInfo.odcIndex]?.trays[odpInfo.trayIndex]?.children[odpInfo.odpIndex];
    if (!odp) {
      console.log('[softDeleteOdp] ODP tidak ditemukan di struktur');
      return false;
    }

    // Proses soft delete untuk setiap ONT yang belum dihapus
    if (odp.children && Array.isArray(odp.children)) {
      for (let ontIndex = 0; ontIndex < odp.children.length; ontIndex++) {
        const ont = odp.children[ontIndex];
        // Hanya proses ONT yang belum memiliki deleted_at
        if (!ont.deleted_at) {
          const ontResult = await softDeleteOnt({
            branchId: odpInfo.branchId,
            routerIndex: odpInfo.routerIndex,
            oltIndex: odpInfo.oltIndex,
            ponPortIndex: odpInfo.ponPortIndex,
            odcIndex: odpInfo.odcIndex,
            trayIndex: odpInfo.trayIndex,
            odpIndex: odpInfo.odpIndex,
            ontIndex
          }, deletedAt); // Gunakan timestamp yang sama

          if (!ontResult) {
            console.log(`[softDeleteOdp] Gagal melakukan soft delete pada ONT di index ${ontIndex}`);
            // Lanjutkan ke ONT berikutnya
            continue;
          }
        }
      }
    }

    console.log('[softDeleteOdp] ODP dan semua ONT berhasil di-soft delete');
    return true;
  } catch (error) {
    console.error('Error soft deleting ODP:', error);
    throw error;
  }
}

/**
 * Melakukan soft delete pada ODC dan semua ODP serta ONT di dalamnya
 * @param {Object} odcInfo - Informasi ODC yang akan di-soft delete
 * @param {Date} deletedAt - Timestamp untuk soft delete (opsional)
 * @returns {Promise<boolean>} - True jika berhasil
 */
async function softDeleteOdc(odcInfo, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteOdc] Mencoba soft delete ODC di branch ${odcInfo.branchId}`);
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

    // Proses soft delete untuk setiap ODP di setiap tray yang belum dihapus
    if (odc.trays && Array.isArray(odc.trays)) {
      for (let trayIndex = 0; trayIndex < odc.trays.length; trayIndex++) {
        const tray = odc.trays[trayIndex];
        if (tray.children && Array.isArray(tray.children)) {
          for (let odpIndex = 0; odpIndex < tray.children.length; odpIndex++) {
            const odp = tray.children[odpIndex];
            // Hanya proses ODP yang belum memiliki deleted_at
            if (!odp.deleted_at) {
              const odpResult = await softDeleteOdp({
                branchId: odcInfo.branchId,
                routerIndex: odcInfo.routerIndex,
                oltIndex: odcInfo.oltIndex,
                ponPortIndex: odcInfo.ponPortIndex,
                odcIndex: odcInfo.odcIndex,
                trayIndex,
                odpIndex
              }, deletedAt); // Gunakan timestamp yang sama

              if (!odpResult) {
                console.log(`[softDeleteOdc] Gagal melakukan soft delete pada ODP di tray ${trayIndex}`);
                // Lanjutkan ke ODP berikutnya
                continue;
              }
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
 * @param {Date} deletedAt - Timestamp untuk soft delete (opsional)
 * @returns {Promise<boolean>} - True jika berhasil
 */
async function softDeleteOlt(oltInfo, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteOlt] Mencoba soft delete OLT di branch ${oltInfo.branchId}`);
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
              }, deletedAt); // Gunakan timestamp yang sama

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
 * Melakukan soft delete pada Router dan semua OLT, ODC, ODP, serta ONT di dalamnya
 * @param {Object} routerData - Data Router yang akan di-soft delete
 * @param {Date} deletedAt - Timestamp untuk soft delete (opsional)
 * @returns {Promise<boolean>} - True jika berhasil
 */
async function softDeleteRouter(routerData, deletedAt = new Date()) {
  try {
    console.log(`[softDeleteRouter] Mencoba soft delete Router di branch ${routerData.branchId}`);
    const collection = getCollection('branches');
    
    // Update Router dengan menambahkan deleted_at
    const result = await collection.updateOne(
      { _id: new ObjectId(routerData.branchId) },
      {
        $set: {
          [`children.${routerData.routerIndex}.deleted_at`]: deletedAt,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log('[softDeleteRouter] Router tidak ditemukan');
      return false;
    }

    // Dapatkan data Router untuk proses OLT
    const branch = await collection.findOne({ _id: new ObjectId(routerData.branchId) });
    if (!branch) {
      console.log('[softDeleteRouter] Branch tidak ditemukan');
      return false;
    }

    const router = branch.children[routerData.routerIndex];
    if (!router) {
      console.log('[softDeleteRouter] Router tidak ditemukan di struktur');
      return false;
    }

    // Proses soft delete untuk setiap OLT yang belum dihapus
    if (router.children && Array.isArray(router.children)) {
      for (let oltIndex = 0; oltIndex < router.children.length; oltIndex++) {
        const olt = router.children[oltIndex];
        // Hanya proses OLT yang belum memiliki deleted_at
        if (!olt.deleted_at) {
          const oltResult = await softDeleteOlt({
            branchId: routerData.branchId,
            routerIndex: routerData.routerIndex,
            oltIndex
          }, deletedAt); // Gunakan timestamp yang sama

          if (!oltResult) {
            console.log(`[softDeleteRouter] Gagal melakukan soft delete pada OLT di index ${oltIndex}`);
            // Lanjutkan ke OLT berikutnya
            continue;
          }
        }
      }
    }

    console.log('[softDeleteRouter] Router dan semua device di bawahnya berhasil di-soft delete');
    return true;
  } catch (error) {
    console.error('Error soft deleting Router:', error);
    throw error;
  }
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