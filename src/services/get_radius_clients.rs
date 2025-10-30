use anyhow::Result;

use crate::entities::radius_client_entity::RadiusClientEntity;
use crate::infrastructures::radius::RadiusService;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::api::radius_api_repository;
use crate::repositories::redis::radius_clients_redis_repository as redis_repo;

const CACHE_KEY: &str = "all";
const CACHE_TTL: usize = 3600; // 1 hour

pub async fn execute(
    radius_service: &RadiusService,
    redis: &RedisConnection,
    key_prefix: &str,
) -> Result<Vec<RadiusClientEntity>> {
    // Try to get from Redis cache first
    let redis_pool = redis.pool();
    if let Ok(mut conn) = redis_pool.get().await {
        if let Ok(Some(cached_data)) = redis_repo::get(&mut conn, key_prefix, CACHE_KEY).await {
            if let Ok(items) = serde_json::from_str::<Vec<RadiusClientEntity>>(&cached_data) {
                log::debug!("radius_clients:get_all:cache_hit");
                return Ok(items);
            }
        }
    }

    // If not in cache, fetch from Radius API
    let items = radius_api_repository::get_clients(radius_service).await?;

    // Store in cache for future requests
    if let Ok(mut conn) = redis_pool.get().await {
        if let Ok(json_data) = serde_json::to_string(&items) {
            let _ = redis_repo::create(&mut conn, key_prefix, CACHE_KEY, &json_data, Some(CACHE_TTL)).await;
        }
    }

    Ok(items)
}
