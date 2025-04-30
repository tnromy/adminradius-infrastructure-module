const { USER_ROLES } = require('../constants/permission.constants');
const { HttpError } = require('../utils/error');

/**
 * Check if user has CLIENT_OWNER role
 * @param {Object} user - User object from request
 * @throws {HttpError} If user is not CLIENT_OWNER
 */
const checkClientOwner = (user) => {
  if (!user || user.role !== USER_ROLES.CLIENT_OWNER) {
    throw new HttpError(403, 'Forbidden: Only client owner can access this resource');
  }
};

/**
 * Check if user role is included in allowed roles
 * @param {Object} user - User object from request
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @throws {HttpError} If user role is not in allowed roles
 */
const checkAllowedRoles = (user, allowedRoles) => {
  if (!user || !allowedRoles.includes(user.role)) {
    throw new HttpError(403, 'Forbidden: User role not authorized for this resource');
  }
};

module.exports = {
  checkClientOwner,
  checkAllowedRoles
}; 