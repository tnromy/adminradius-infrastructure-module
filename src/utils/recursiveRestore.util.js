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

module.exports = {
  restoreOnt,
  restoreOdp,
  restoreOdc,
  restoreOlt
}; 