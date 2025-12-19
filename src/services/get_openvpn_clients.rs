use thiserror::Error;

use crate::entities::openvpn_client_entity::OpenvpnClientEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::postgresql::openvpn_client_postgres_repository as pg_repository;

#[derive(Debug, Error)]
pub enum GetOpenvpnClientsError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("redis error: {0}")]
    Redis(#[from] deadpool_redis::redis::RedisError),
    #[error("redis pool error: {0}")]
    RedisPool(#[from] deadpool_redis::PoolError),
    #[error("json serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

fn cache_key(server_id: &str) -> String {
    format!("adminradius_infra:openvpn_clients:{}", server_id)
}

pub async fn execute(
    db: &DatabaseConnection,
    redis: &RedisConnection,
    server_id: &str,
    is_cache: bool,
) -> Result<Vec<OpenvpnClientEntity>, GetOpenvpnClientsError> {
    let key = cache_key(server_id);

    // If is_cache = true, try to get from Redis first
    if is_cache {
        let redis_pool = redis.pool();
        let mut redis_conn = redis_pool.get().await?;

        if let Some(cached_data) = get_from_redis(&mut redis_conn, &key).await? {
            log::debug!("openvpn_clients:get:cache_hit server_id={}", server_id);
            let items: Vec<OpenvpnClientEntity> = serde_json::from_str(&cached_data)?;
            return Ok(items);
        }
        log::debug!("openvpn_clients:get:cache_miss server_id={}", server_id);
    } else {
        log::debug!("openvpn_clients:get:cache_bypass server_id={}", server_id);
    }

    // Get from PostgreSQL
    let pool = db.get_pool();
    let items = pg_repository::find_by_server_id(pool.as_ref(), server_id).await?;

    // Update Redis cache
    let redis_pool = redis.pool();
    let mut redis_conn = redis_pool.get().await?;
    let serialized = serde_json::to_string(&items)?;
    let _cache_result = set_to_redis(&mut redis_conn, &key, &serialized).await;
    if let Err(ref e) = _cache_result {
        log::warn!("openvpn_clients:get:cache_update_failed err={}", e);
    } else {
        log::debug!("openvpn_clients:get:cache_updated server_id={}", server_id);
    }

    Ok(items)
}

pub async fn invalidate_cache(redis: &RedisConnection, server_id: &str) {
    let key = cache_key(server_id);
    let redis_pool = redis.pool();

    match redis_pool.get().await {
        Ok(mut redis_conn) => {
            let result: Result<(), deadpool_redis::redis::RedisError> =
                deadpool_redis::redis::cmd("DEL")
                    .arg(&key)
                    .query_async(&mut *redis_conn)
                    .await;

            if let Err(e) = result {
                log::warn!("openvpn_clients:invalidate_cache:failed err={}", e);
            } else {
                log::debug!("openvpn_clients:invalidate_cache:ok server_id={}", server_id);
            }
        }
        Err(e) => {
            log::warn!("openvpn_clients:invalidate_cache:pool_error err={}", e);
        }
    }
}

async fn get_from_redis(
    conn: &mut deadpool_redis::Connection,
    key: &str,
) -> Result<Option<String>, deadpool_redis::redis::RedisError> {
    deadpool_redis::redis::cmd("GET")
        .arg(key)
        .query_async(&mut *conn)
        .await
}

async fn set_to_redis(
    conn: &mut deadpool_redis::Connection,
    key: &str,
    value: &str,
) -> Result<(), deadpool_redis::redis::RedisError> {
    // Set with TTL of 1 hour (3600 seconds)
    deadpool_redis::redis::cmd("SET")
        .arg(key)
        .arg(value)
        .arg("EX")
        .arg(3600)
        .query_async(&mut *conn)
        .await
}
