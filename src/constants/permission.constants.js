/**
 * Constants untuk permission dan roles
 */

const PERMISSION_TYPES = {
  READ_ONLY: 'RO',
  READ_WRITE: 'RW'
};

/**
 * Enum for user roles in the system
 * @readonly
 * @enum {string}
 */
const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CLIENT_OWNER: 'CLIENT_OWNER',
  CLIENT_ADMIN: 'CLIENT_ADMIN',
  CLIENT_STAFF: 'CLIENT_STAFF'
};

/**
 * Enum for permission levels in the system
 * @readonly
 * @enum {string}
 */
const PERMISSION_LEVELS = {
  READ: 'READ',
  WRITE: 'WRITE',
  ADMIN: 'ADMIN'
};

const ERROR_MESSAGES = {
  BRANCH_ACCESS_DENIED: 'Forbidden - You do not have access to this branch',
  WRITE_ACCESS_DENIED: 'Forbidden - You do not have write access to this branch',
  DEVICE_NOT_FOUND: (deviceType) => `${deviceType.toUpperCase()} not found or not associated with any branch`,
  INTERNAL_ERROR: {
    BRANCH_PERMISSION: 'Internal server error while checking branch permission',
    WRITE_PERMISSION: 'Internal server error while checking write permission',
    BRANCHES_PERMISSION: 'Internal server error while checking branches permission'
  }
};

module.exports = {
  PERMISSION_TYPES,
  USER_ROLES,
  PERMISSION_LEVELS,
  ERROR_MESSAGES
}; 