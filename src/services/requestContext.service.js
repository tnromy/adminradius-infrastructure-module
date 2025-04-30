/**
 * Service untuk mengelola request context menggunakan async_hooks
 */

const { AsyncLocalStorage } = require('async_hooks');
const { v4: uuidv4 } = require('uuid');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Class untuk menyimpan data context request
 */
class RequestContext {
  constructor() {
    this.requestId = uuidv4();
    this.userId = null;
    this.userRoles = [];
    this.branchAccess = null;
    this.branchAccessList = [];
  }

  /**
   * Set user ID dari JWT sub claim
   * @param {string} userId - User ID
   */
  setUserId(userId) {
    this.userId = userId;
  }

  /**
   * Set roles user dari JWT roles claim
   * @param {Array} roles - Array of role objects
   */
  setUserRoles(roles) {
    this.userRoles = roles;
  }

  /**
   * Set request ID
   * @param {string} requestId - Request ID
   */
  setRequestId(requestId) {
    this.requestId = requestId;
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getUserId() {
    return this.userId;
  }

  /**
   * Get user roles
   * @returns {Array} Array of role objects
   */
  getUserRoles() {
    return this.userRoles;
  }

  /**
   * Get request ID
   * @returns {string} Request ID
   */
  getRequestId() {
    return this.requestId;
  }

  setBranchAccess(branchAccess) {
    this.branchAccess = branchAccess;
  }

  getBranchAccess() {
    return this.branchAccess;
  }

  setBranchAccessList(branchAccessList) {
    this.branchAccessList = branchAccessList;
  }

  getBranchAccessList() {
    return this.branchAccessList;
  }

  getAccessibleBranchIds() {
    return this.branchAccessList.map(access => access.branch_id);
  }
}

/**
 * Middleware untuk menginisialisasi request context
 */
function initializeRequestContext(req, res, next) {
  asyncLocalStorage.run(new RequestContext(), () => {
    next();
  });
}

/**
 * Get current request context
 * @returns {RequestContext} Current request context
 */
function getRequestContext() {
  return asyncLocalStorage.getStore();
}

module.exports = {
  RequestContext,
  initializeRequestContext,
  getRequestContext
}; 