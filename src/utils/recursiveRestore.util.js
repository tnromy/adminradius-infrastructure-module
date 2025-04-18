/**
 * Utilitas untuk melakukan restore secara rekursif pada perangkat jaringan
 */

const { getCollection } = require('../repositories/database.connector');
const { ObjectId } = require('mongoose').Types;

/**
 * Helper untuk melakukan restore pada device dan children-nya
 * @param {Object} query - Query untuk mencari device
 * @param {Object} device - Device yang akan di-restore
 * @param {string} devicePath - Path ke device dalam struktur data
 * @param {Date} deletedAt - Timestamp deleted_at yang akan di-restore
 * @returns {Promise<Object>} - Hasil restore
 */
async function restoreDeviceAndChildren(query, device, devicePath, deletedAt) {
  const collection = getCollection('branches');
  
  // Restore device itu sendiri
  const restoreResult = await collection.updateOne(
    {
      ...query,
      [`${devicePath}.deleted_at`]: deletedAt // Hanya restore jika deleted_at sama
    },
    {
      $unset: {
        [`${devicePath}.deleted_at`]: ""
      },
      $set: {
        updatedAt: new Date()
      }
    }
  );
  
  return restoreResult;
}

/**
 * Melakukan restore pada ONT
 * @param {string} ontId - ID ONT yang akan di-restore
 * @returns {Promise<Object>} - Hasil restore
 */
async function restoreOnt(ontId) {
  try {
    const collection = getCollection('branches');
    
    // Cari ONT dan dapatkan timestamp deleted_at nya
    const branch = await collection.findOne({
      'children.children.pon_port.children.trays.children.children.children._id': new ObjectId(ontId)
    });
    
    if (!branch) return null;
    
    // Cari ONT dalam struktur nested
    let foundOnt = null;
    const searchOnt = (obj) => {
      if (obj._id && obj._id.toString() === ontId.toString()) {
        foundOnt = obj;
        return;
      }
      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach(searchOnt);
      }
      if (obj.pon_port && Array.isArray(obj.pon_port)) {
        obj.pon_port.forEach(port => {
          if (port.children) port.children.forEach(searchOnt);
        });
      }
      if (obj.trays && Array.isArray(obj.trays)) {
        obj.trays.forEach(tray => {
          if (tray.children) tray.children.forEach(searchOnt);
        });
      }
    };
    
    searchOnt(branch);
    
    if (!foundOnt || !foundOnt.deleted_at) return null;
    
    const deletedAt = foundOnt.deleted_at;
    
    // Restore ONT
    const result = await collection.updateOne(
      {
        'children.children.pon_port.children.trays.children.children.children._id': new ObjectId(ontId),
        'children.children.pon_port.children.trays.children.children.children.deleted_at': deletedAt
      },
      {
        $unset: {
          'children.$[].children.$[].pon_port.$[].children.$[].trays.$[].children.$[].children.$[ont].deleted_at': ""
        },
        $set: {
          updatedAt: new Date()
        }
      },
      {
        arrayFilters: [
          { 'ont._id': new ObjectId(ontId) }
        ]
      }
    );
    
    return result;
  } catch (error) {
    console.error('Error restoring ONT:', error);
    throw error;
  }
}

/**
 * Melakukan restore pada ODP dan children-nya
 * @param {string} odpId - ID ODP yang akan di-restore
 * @returns {Promise<Object>} - Hasil restore
 */
async function restoreOdp(odpId) {
  try {
    console.log(`[recursiveRestore.restoreOdp] Mencoba restore ODP dengan ID: ${odpId}`);
    const collection = getCollection('branches');
    
    // Cari ODP dan dapatkan timestamp deleted_at nya
    const branch = await collection.findOne({
      'children.children.pon_port.children.trays.children._id': new ObjectId(odpId)
    });
    
    console.log(`[recursiveRestore.restoreOdp] Branch ditemukan: ${branch ? 'Ya' : 'Tidak'}`);
    
    if (!branch) return null;
    
    // Cari ODP dalam struktur nested
    let foundOdp = null;
    let odpPath = '';
    const searchOdp = (obj, path = '') => {
      if (obj._id && obj._id.toString() === odpId.toString()) {
        console.log('[recursiveRestore.restoreOdp] ODP ditemukan dalam struktur');
        foundOdp = obj;
        odpPath = path;
        return;
      }
      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach((child, idx) => searchOdp(child, path ? `${path}.children.${idx}` : `children.${idx}`));
      }
      if (obj.pon_port && Array.isArray(obj.pon_port)) {
        obj.pon_port.forEach((port, idx) => {
          if (port.children) {
            port.children.forEach((child, childIdx) => 
              searchOdp(child, path ? `${path}.pon_port.${idx}.children.${childIdx}` : `pon_port.${idx}.children.${childIdx}`));
          }
        });
      }
      if (obj.trays && Array.isArray(obj.trays)) {
        obj.trays.forEach((tray, idx) => {
          if (tray.children) {
            tray.children.forEach((child, childIdx) => 
              searchOdp(child, path ? `${path}.trays.${idx}.children.${childIdx}` : `trays.${idx}.children.${childIdx}`));
          }
        });
      }
    };
    
    searchOdp(branch);
    
    console.log(`[recursiveRestore.restoreOdp] Status ODP:`, {
      found: !!foundOdp,
      hasDeletedAt: foundOdp ? !!foundOdp.deleted_at : false,
      path: odpPath
    });
    
    if (!foundOdp || !foundOdp.deleted_at) return null;
    
    const deletedAt = foundOdp.deleted_at;
    
    // 1. Restore ODP
    console.log('[recursiveRestore.restoreOdp] Mencoba update ODP di database');
    const odpResult = await collection.updateOne(
      {
        _id: branch._id,
        [`${odpPath}.deleted_at`]: deletedAt // Pastikan kita update ODP dengan deleted_at yang tepat
      },
      {
        $unset: {
          [`${odpPath}.deleted_at`]: ""
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`[recursiveRestore.restoreOdp] Hasil update ODP:`, {
      matchedCount: odpResult.matchedCount,
      modifiedCount: odpResult.modifiedCount
    });
    
    // 2. Restore ONTs yang memiliki deleted_at yang sama persis
    if (foundOdp.children && Array.isArray(foundOdp.children)) {
      console.log('[recursiveRestore.restoreOdp] Mencoba restore ONTs');
      const ontRestorePromises = foundOdp.children
        .map((ont, idx) => {
          if (ont.deleted_at && ont.deleted_at.getTime() === deletedAt.getTime()) {
            return collection.updateOne(
              {
                _id: branch._id,
                [`${odpPath}.children.${idx}.deleted_at`]: deletedAt
              },
              {
                $unset: {
                  [`${odpPath}.children.${idx}.deleted_at`]: ""
                },
                $set: {
                  updatedAt: new Date()
                }
              }
            );
          }
          return null;
        })
        .filter(Boolean);
      
      if (ontRestorePromises.length > 0) {
        console.log(`[recursiveRestore.restoreOdp] Merestore ${ontRestorePromises.length} ONT`);
        await Promise.all(ontRestorePromises);
      }
    }
    
    return odpResult.modifiedCount > 0 ? odpResult : null;
  } catch (error) {
    console.error('Error restoring ODP:', error);
    throw error;
  }
}

/**
 * Melakukan restore pada ODC dan children-nya
 * @param {string} odcId - ID ODC yang akan di-restore
 * @returns {Promise<Object>} - Hasil restore
 */
async function restoreOdc(odcId) {
  try {
    const collection = getCollection('branches');
    
    // Cari ODC dan dapatkan timestamp deleted_at nya
    const branch = await collection.findOne({
      'children.children.pon_port.children._id': new ObjectId(odcId)
    });
    
    if (!branch) return null;
    
    // Cari ODC dalam struktur nested
    let foundOdc = null;
    const searchOdc = (obj) => {
      if (obj._id && obj._id.toString() === odcId.toString()) {
        foundOdc = obj;
        return;
      }
      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach(searchOdc);
      }
      if (obj.pon_port && Array.isArray(obj.pon_port)) {
        obj.pon_port.forEach(port => {
          if (port.children) port.children.forEach(searchOdc);
        });
      }
    };
    
    searchOdc(branch);
    
    if (!foundOdc || !foundOdc.deleted_at) return null;
    
    const deletedAt = foundOdc.deleted_at;
    
    // 1. Restore ODC
    const odcResult = await collection.updateOne(
      {
        'children.children.pon_port.children._id': new ObjectId(odcId),
        'children.children.pon_port.children.deleted_at': deletedAt
      },
      {
        $unset: {
          'children.$[].children.$[].pon_port.$[].children.$[odc].deleted_at': ""
        },
        $set: {
          updatedAt: new Date()
        }
      },
      {
        arrayFilters: [
          { 'odc._id': new ObjectId(odcId) }
        ]
      }
    );
    
    // 2. Restore ODPs yang memiliki deleted_at yang sama
    if (foundOdc.trays && Array.isArray(foundOdc.trays)) {
      for (const tray of foundOdc.trays) {
        if (tray.children && Array.isArray(tray.children)) {
          const odpRestorePromises = tray.children
            .filter(odp => odp.deleted_at && odp.deleted_at.getTime() === deletedAt.getTime())
            .map(odp => restoreOdp(odp._id.toString()));
          
          await Promise.all(odpRestorePromises);
        }
      }
    }
    
    return odcResult;
  } catch (error) {
    console.error('Error restoring ODC:', error);
    throw error;
  }
}

/**
 * Melakukan restore pada OLT dan semua ODC, ODP, dan ONT di dalamnya
 * @param {string} oltId - ID OLT yang akan di-restore
 * @returns {Promise<Object>} - Hasil restore
 */
async function restoreOlt(oltId) {
  try {
    console.log(`[recursiveRestore.restoreOlt] Mencoba restore OLT dengan ID: ${oltId}`);
    const collection = getCollection('branches');
    
    // Cari OLT dan dapatkan timestamp deleted_at nya
    const branch = await collection.findOne({
      'children.children._id': new ObjectId(oltId)
    });
    
    console.log(`[recursiveRestore.restoreOlt] Branch ditemukan: ${branch ? 'Ya' : 'Tidak'}`);
    
    if (!branch) return null;
    
    // Cari OLT dalam struktur nested
    let foundOlt = null;
    let oltPath = '';
    const searchOlt = (obj, path = '') => {
      if (obj._id && obj._id.toString() === oltId.toString()) {
        console.log('[recursiveRestore.restoreOlt] OLT ditemukan dalam struktur');
        foundOlt = obj;
        oltPath = path;
        return;
      }
      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach((child, idx) => searchOlt(child, path ? `${path}.children.${idx}` : `children.${idx}`));
      }
    };
    
    searchOlt(branch);
    
    console.log(`[recursiveRestore.restoreOlt] Status OLT:`, {
      found: !!foundOlt,
      hasDeletedAt: foundOlt ? !!foundOlt.deleted_at : false,
      path: oltPath
    });
    
    if (!foundOlt || !foundOlt.deleted_at) return null;
    
    const deletedAt = foundOlt.deleted_at;
    
    // 1. Restore OLT
    console.log('[recursiveRestore.restoreOlt] Mencoba update OLT di database');
    const oltResult = await collection.updateOne(
      {
        _id: branch._id,
        [`${oltPath}.deleted_at`]: deletedAt // Pastikan kita update OLT dengan deleted_at yang tepat
      },
      {
        $unset: {
          [`${oltPath}.deleted_at`]: ""
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`[recursiveRestore.restoreOlt] Hasil update OLT:`, {
      matchedCount: oltResult.matchedCount,
      modifiedCount: oltResult.modifiedCount
    });
    
    // 2. Restore ODCs yang memiliki deleted_at yang sama
    if (foundOlt.pon_port && Array.isArray(foundOlt.pon_port)) {
      console.log('[recursiveRestore.restoreOlt] Mencoba restore ODCs');
      for (const [ponPortIndex, ponPort] of foundOlt.pon_port.entries()) {
        if (ponPort.children && Array.isArray(ponPort.children)) {
          const odcRestorePromises = ponPort.children
            .filter(odc => odc.deleted_at && odc.deleted_at.getTime() === deletedAt.getTime())
            .map(odc => restoreOdc(odc._id.toString()));
          
          if (odcRestorePromises.length > 0) {
            console.log(`[recursiveRestore.restoreOlt] Merestore ${odcRestorePromises.length} ODC di port ${ponPort.port}`);
            await Promise.all(odcRestorePromises);
          }
        }
      }
    }
    
    return oltResult.modifiedCount > 0 ? oltResult : null;
  } catch (error) {
    console.error('Error restoring OLT:', error);
    throw error;
  }
}

/**
 * Melakukan restore pada Router dan semua OLT, ODC, ODP, serta ONT di dalamnya
 * @param {string} routerId - ID Router yang akan di-restore
 * @returns {Promise<Object|null>} - Router yang sudah di-restore atau null jika gagal
 */
async function restoreRouter(routerId) {
  try {
    console.log(`[restoreRouter] Mencoba restore Router dengan ID: ${routerId}`);
    const collection = getCollection('branches');
    
    // Cari branch yang memiliki Router dengan ID yang sesuai
    const branch = await collection.findOne({
      'children._id': new ObjectId(routerId)
    });
    
    if (!branch) {
      console.log('[restoreRouter] Branch tidak ditemukan');
      return null;
    }
    
    // Cari Router dan dapatkan informasi lengkapnya
    let routerIndex = -1;
    let routerData = null;
    let routerDeletedAt = null;
    
    for (let i = 0; i < branch.children.length; i++) {
      const router = branch.children[i];
      if (router._id.toString() === routerId.toString()) {
        routerIndex = i;
        routerData = router;
        routerDeletedAt = router.deleted_at;
        break;
      }
    }
    
    if (!routerData || !routerDeletedAt) {
      console.log('[restoreRouter] Router tidak ditemukan atau tidak memiliki deleted_at');
      return null;
    }
    
    console.log(`[restoreRouter] Router ditemukan dengan deleted_at: ${routerDeletedAt}`);
    
    // Restore Router dengan menghapus deleted_at
    const routerResult = await restoreDeviceAndChildren(
      { _id: branch._id },
      'router',
      `children.${routerIndex}`,
      routerDeletedAt
    );
    
    if (!routerResult) {
      console.log('[restoreRouter] Gagal melakukan restore Router');
      return null;
    }
    
    // Restore semua OLT yang memiliki deleted_at yang sama
    if (routerData.children && Array.isArray(routerData.children)) {
      for (let oltIndex = 0; oltIndex < routerData.children.length; oltIndex++) {
        const olt = routerData.children[oltIndex];
        
        // Hanya restore OLT yang memiliki deleted_at yang sama dengan Router
        if (olt.deleted_at && olt.deleted_at.getTime() === routerDeletedAt.getTime()) {
          console.log(`[restoreRouter] Mencoba restore OLT di index ${oltIndex}`);
          
          // Restore OLT dan semua device di bawahnya
          await restoreDeviceAndChildren(
            { _id: branch._id },
            'olt',
            `children.${routerIndex}.children.${oltIndex}`,
            routerDeletedAt
          );
          
          // Restore ODCs
          if (olt.pon_port && Array.isArray(olt.pon_port)) {
            for (let ponPortIndex = 0; ponPortIndex < olt.pon_port.length; ponPortIndex++) {
              const ponPort = olt.pon_port[ponPortIndex];
              if (ponPort.children && Array.isArray(ponPort.children)) {
                for (let odcIndex = 0; odcIndex < ponPort.children.length; odcIndex++) {
                  const odc = ponPort.children[odcIndex];
                  
                  // Hanya restore ODC yang memiliki deleted_at yang sama
                  if (odc.deleted_at && odc.deleted_at.getTime() === routerDeletedAt.getTime()) {
                    console.log(`[restoreRouter] Mencoba restore ODC di port ${ponPortIndex}, index ${odcIndex}`);
                    
                    await restoreDeviceAndChildren(
                      { _id: branch._id },
                      'odc',
                      `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}`,
                      routerDeletedAt
                    );
                    
                    // Restore ODPs
                    if (odc.trays && Array.isArray(odc.trays)) {
                      for (let trayIndex = 0; trayIndex < odc.trays.length; trayIndex++) {
                        const tray = odc.trays[trayIndex];
                        if (tray.children && Array.isArray(tray.children)) {
                          for (let odpIndex = 0; odpIndex < tray.children.length; odpIndex++) {
                            const odp = tray.children[odpIndex];
                            
                            // Hanya restore ODP yang memiliki deleted_at yang sama
                            if (odp.deleted_at && odp.deleted_at.getTime() === routerDeletedAt.getTime()) {
                              console.log(`[restoreRouter] Mencoba restore ODP di tray ${trayIndex}, index ${odpIndex}`);
                              
                              await restoreDeviceAndChildren(
                                { _id: branch._id },
                                'odp',
                                `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}`,
                                routerDeletedAt
                              );
                              
                              // Restore ONTs
                              if (odp.children && Array.isArray(odp.children)) {
                                for (let ontIndex = 0; ontIndex < odp.children.length; ontIndex++) {
                                  const ont = odp.children[ontIndex];
                                  
                                  // Hanya restore ONT yang memiliki deleted_at yang sama
                                  if (ont.deleted_at && ont.deleted_at.getTime() === routerDeletedAt.getTime()) {
                                    console.log(`[restoreRouter] Mencoba restore ONT di index ${ontIndex}`);
                                    
                                    await restoreDeviceAndChildren(
                                      { _id: branch._id },
                                      'ont',
                                      `children.${routerIndex}.children.${oltIndex}.pon_port.${ponPortIndex}.children.${odcIndex}.trays.${trayIndex}.children.${odpIndex}.children.${ontIndex}`,
                                      routerDeletedAt
                                    );
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log('[restoreRouter] Router dan semua device di bawahnya berhasil di-restore');
    return true;
  } catch (error) {
    console.error('Error in restoreRouter:', error);
    throw error;
  }
}

/**
 * Melakukan restore pada branch dan semua device di dalamnya
 * @param {string} branchId - ID branch yang akan di-restore
 * @returns {Promise<Object|null>} - Branch yang sudah di-restore atau null jika gagal
 */
async function restoreBranch(branchId) {
  try {
    console.log(`[restoreBranch] Mencoba restore branch dengan ID: ${branchId}`);
    const collection = getCollection('branches');

    // Cari branch yang memiliki deleted_at
    const branch = await collection.findOne({ 
      _id: new ObjectId(branchId),
      deleted_at: { $exists: true }
    });

    if (!branch) {
      console.log('[restoreBranch] Branch tidak ditemukan atau sudah di-restore');
      return null;
    }

    // Simpan timestamp deleted_at untuk digunakan dalam restore device
    const deletedAt = branch.deleted_at;
    console.log(`[restoreBranch] Timestamp deleted_at branch: ${deletedAt}`);

    // Restore branch dengan menghapus field deleted_at
    const result = await collection.updateOne(
      { _id: new ObjectId(branchId) },
      {
        $unset: { deleted_at: "" },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      console.log('[restoreBranch] Gagal melakukan restore branch');
      return null;
    }

    // Restore semua router yang memiliki deleted_at yang sama
    if (branch.children && Array.isArray(branch.children)) {
      for (let routerIndex = 0; routerIndex < branch.children.length; routerIndex++) {
        const router = branch.children[routerIndex];
        if (router.deleted_at && router.deleted_at.getTime() === deletedAt.getTime()) {
          const routerId = router._id.toString();
          console.log(`[restoreBranch] Mencoba restore router dengan ID: ${routerId}`);
          
          await restoreRouter(routerId);
        }
      }
    }

    // Ambil data branch yang sudah di-restore
    const restoredBranch = await collection.findOne({ _id: new ObjectId(branchId) });
    console.log('[restoreBranch] Branch dan semua device berhasil di-restore');
    
    return restoredBranch;
  } catch (error) {
    console.error('Error restoring branch:', error);
    throw error;
  }
}

module.exports = {
  restoreDeviceAndChildren,
  restoreOnt,
  restoreOdp,
  restoreOdc,
  restoreOlt,
  restoreRouter,
  restoreBranch
}; 