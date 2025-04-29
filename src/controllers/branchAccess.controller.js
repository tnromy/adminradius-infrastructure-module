/**
 * Controller untuk mengelola branch access
 */

const { ObjectId } = require('mongodb');
const branchAccessRepository = require('../repositories/branchAccess.repository');
const { getRequestContext } = require('../services/requestContext.service');
const { logDebug, logError, logInfo, logWarn, createErrorResponse } = require('../services/logger.service');
const { BranchAccessStatus, BranchAccessPermission } = require('../entities/branchAccess.entity');

/**
 * Mendapatkan daftar branch access berdasarkan status
 */
async function getBranchAccessList(req, res) {
  const context = getRequestContext();
  const status = req.query.status || BranchAccessStatus.SUBMITTED;

  logDebug('Mengambil daftar branch access', {
    requestId: context.getRequestId(),
    status: status
  });

  try {
    const branchAccessList = await branchAccessRepository.getBranchAccessByStatus(status);

    logInfo('Berhasil mengambil daftar branch access', {
      requestId: context.getRequestId(),
      count: branchAccessList.length,
      status: status
    });

    res.json({
      data: branchAccessList
    });
  } catch (error) {
    logError('Gagal mengambil daftar branch access', {
      requestId: context.getRequestId(),
      error: error.message,
      stack: error.stack
    });

    res.status(500).json(createErrorResponse(
      500,
      'Internal server error - Failed to get branch access list'
    ));
  }
}

/**
 * Membuat atau mengupdate branch access request
 */
async function createBranchAccess(req, res) {
  const context = getRequestContext();
  const branchId = req.params.branch_id;
  const { user_note } = req.body;
  const { name, email, phone, picture } = req.userInfo;

  logDebug('Membuat branch access request', {
    requestId: context.getRequestId(),
    branchId: branchId,
    userId: context.getUserId()
  });

  try {
    // Cek apakah sudah ada request sebelumnya
    const existingAccess = await branchAccessRepository.findBranchAccessByBranchIdAndUserId(
      branchId,
      context.getUserId()
    );

    let result;
    if (existingAccess) {
      // Update request yang sudah ada
      result = await branchAccessRepository.updateBranchAccess(existingAccess._id, {
        status: BranchAccessStatus.SUBMITTED,
        user_note: user_note || null,
        name,
        email,
        phone,
        ava_path: picture,
        reviewer_note: null,
        approved_by_user_id: null,
        rejected_by_user_id: null,
        revoked_by_user_id: null
      });

      logInfo('Berhasil mengupdate branch access request', {
        requestId: context.getRequestId(),
        branchAccessId: result._id,
        branchId: branchId,
        userId: context.getUserId()
      });
    } else {
      // Buat request baru
      result = await branchAccessRepository.addBranchAccess({
        branch_id: new ObjectId(branchId),
        user_id: context.getUserId(),
        status: BranchAccessStatus.SUBMITTED,
        permission: null,
        user_note: user_note || null,
        name,
        email,
        phone,
        ava_path: picture
      });

      logInfo('Berhasil membuat branch access request baru', {
        requestId: context.getRequestId(),
        branchAccessId: result._id,
        branchId: branchId,
        userId: context.getUserId()
      });
    }

    res.status(201).json({
      message: existingAccess ? 'Branch access request updated' : 'Branch access request created',
      data: result
    });
  } catch (error) {
    logError('Gagal membuat/mengupdate branch access request', {
      requestId: context.getRequestId(),
      error: error.message,
      stack: error.stack
    });

    res.status(500).json(createErrorResponse(
      500,
      'Internal server error - Failed to create/update branch access request'
    ));
  }
}

/**
 * Mengupdate status dan permission branch access
 */
async function updateBranchAccess(req, res) {
  const context = getRequestContext();
  const branchAccessId = req.params.branch_access_id;
  const { status, permission, reviewer_note } = req.body;

  logDebug('Mengupdate branch access', {
    requestId: context.getRequestId(),
    branchAccessId: branchAccessId,
    status: status,
    permission: permission
  });

  try {
    // Cek apakah branch access exists
    const existingAccess = await branchAccessRepository.findById(branchAccessId);
    if (!existingAccess) {
      logWarn('Branch access tidak ditemukan', {
        requestId: context.getRequestId(),
        branchAccessId: branchAccessId
      });

      return res.status(404).json(createErrorResponse(
        404,
        'Branch access not found'
      ));
    }

    // Cek apakah status saat ini SUBMITTED
    if (existingAccess.status !== BranchAccessStatus.SUBMITTED) {
      logWarn('Branch access tidak dapat diupdate karena status bukan SUBMITTED', {
        requestId: context.getRequestId(),
        branchAccessId: branchAccessId,
        currentStatus: existingAccess.status
      });

      return res.status(400).json(createErrorResponse(
        400,
        'Branch access cannot be updated because status is not SUBMITTED'
      ));
    }

    const updateData = {
      status,
      permission,
      reviewer_note: reviewer_note || null
    };

    // Set reviewer berdasarkan status
    if (status === BranchAccessStatus.APPROVED) {
      updateData.approved_by_user_id = context.getUserId();
      updateData.rejected_by_user_id = null;
    } else if (status === BranchAccessStatus.REJECTED) {
      updateData.rejected_by_user_id = context.getUserId();
      updateData.approved_by_user_id = null;
    }

    const result = await branchAccessRepository.updateBranchAccess(branchAccessId, updateData);

    logInfo('Berhasil mengupdate branch access', {
      requestId: context.getRequestId(),
      branchAccessId: branchAccessId,
      status: status,
      permission: permission
    });

    res.json({
      message: 'Branch access updated successfully',
      data: result
    });
  } catch (error) {
    logError('Gagal mengupdate branch access', {
      requestId: context.getRequestId(),
      error: error.message,
      stack: error.stack
    });

    res.status(500).json(createErrorResponse(
      500,
      'Internal server error - Failed to update branch access'
    ));
  }
}

module.exports = {
  getBranchAccessList,
  createBranchAccess,
  updateBranchAccess
}; 