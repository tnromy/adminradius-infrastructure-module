/**
 * Database connector untuk mengakses connection pool MongoDB
 */

const { getConnection } = require('../../connections/mongodb_conn');

/**
 * Mendapatkan referensi ke database adminradius
 * @returns {Object} - Objek database MongoDB
 */
const getDatabase = () => {
  const connection = getConnection();
  if (!connection) {
    throw new Error('Database connection not established');
  }
  return connection.connection.useDb('adminradius');
};

/**
 * Mendapatkan collection tertentu dari database adminradius
 * @param {string} collectionName - Nama collection
 * @returns {Object} - Objek collection MongoDB
 */
const getCollection = (collectionName) => {
  const db = getDatabase();
  return db.collection(collectionName);
};

module.exports = {
  getDatabase,
  getCollection
};
