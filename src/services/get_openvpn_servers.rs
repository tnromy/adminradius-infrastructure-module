use thiserror::Error;

use crate::entities::openvpn_server_entity::OpenvpnServerEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::postgresql::openvpn_server_postgres_repository as pg_repository;
use crate::repositories::redis::openvpn_servers_redis_repository as redis_repository;

#[derive(Debug, Error)]
pub enum GetOpenvpnServersError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("redis error: {0}")]
    Redis(#[from] deadpool_redis::redis::RedisError),
    #[error("redis pool error: {0}")]
    RedisPool(#[from] deadpool_redis::PoolError),
    #[error("json serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    redis: &RedisConnection,
    is_cache: bool,
) -> Result<Vec<OpenvpnServerEntity>, GetOpenvpnServersError> {
    let key_prefix = "adminradius_infra";

    // If is_cache = true, try to get from Redis first
    if is_cache {
        let redis_pool = redis.pool();
        let mut redis_conn = redis_pool.get().await?;

        if let Some(cached_data) = redis_repository::get(&mut *redis_conn, key_prefix).await? {
            log::debug!("openvpn_servers:get:cache_hit");
            let items: Vec<OpenvpnServerEntity> = serde_json::from_str(&cached_data)?;
            return Ok(items);
        }
        log::debug!("openvpn_servers:get:cache_miss");
    } else {
        log::debug!("openvpn_servers:get:cache_bypass");
    }

    // Get from PostgreSQL
    let pool = db.get_pool();
    let items = pg_repository::get_all(pool.as_ref()).await?;

    // Update Redis cache
    let redis_pool = redis.pool();
    let mut redis_conn = redis_pool.get().await?;
    let serialized = serde_json::to_string(&items)?;
    let _cache_result = redis_repository::create(&mut *redis_conn, key_prefix, &serialized, None).await;
    if let Err(ref e) = _cache_result {
        log::warn!("openvpn_servers:get:cache_update_failed err={}", e);
    } else {
        log::debug!("openvpn_servers:get:cache_updated");
    }

    Ok(items)
}
