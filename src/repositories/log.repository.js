/**
 * Repository untuk operasi logging ke Elasticsearch
 */

const { Client } = require('@elastic/elasticsearch');
const config = require('../../config/app.config');
const { createLogEntity } = require('../entities/log.entity');

// Inisialisasi Elasticsearch client
const client = new Client({
  node: config.elasticsearch.node,
  auth: {
    username: config.elasticsearch.auth.username,
    password: config.elasticsearch.auth.password
  }
});

/**
 * Menyimpan log ke Elasticsearch
 * @param {Object} logData - Data log yang akan disimpan
 * @returns {Promise<Object>} - Response dari Elasticsearch
 */
async function createLog(logData) {
  try {
    const logEntity = createLogEntity(logData);
    
    const result = await client.index({
      index: config.elasticsearch.index,
      id: logEntity._id,
      document: logEntity
    });

    return result;
  } catch (error) {
    console.error('Error creating log in Elasticsearch:', error);
    throw error;
  }
}

/**
 * Mencari log berdasarkan kriteria
 * @param {Object} criteria - Kriteria pencarian
 * @returns {Promise<Array>} - Array of logs
 */
async function searchLogs(criteria) {
  try {
    const { body } = await client.search({
      index: config.elasticsearch.index,
      body: {
        query: {
          bool: {
            must: Object.entries(criteria).map(([key, value]) => ({
              match: { [key]: value }
            }))
          }
        },
        sort: [{ timestamp: 'desc' }]
      }
    });

    return body.hits.hits.map(hit => hit._source);
  } catch (error) {
    console.error('Error searching logs in Elasticsearch:', error);
    throw error;
  }
}

module.exports = {
  createLog,
  searchLogs
}; 