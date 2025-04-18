/**
 * Service untuk mengelola request context menggunakan async_hooks
 */

const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Class untuk menyimpan data context request
 */
class RequestContext {
  constructor() {
    this.userId = null;
    this.userRoles = [];
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