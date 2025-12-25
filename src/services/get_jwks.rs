use config::Config;
use deadpool_redis::Pool;
use std::sync::Arc;

use crate::entities::jwks_entity::JwksEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;
use crate::repositories::api::oauth2_issuer_api_repository;
use crate::repositories::redis::jwks_redis_repository;

/// Default JWKS cache expires in seconds (1 day)
const DEFAULT_JWKS_CACHE_EXPIRES: i64 = 86400;

/// Get JWKS from Redis cache or fetch from OAuth2 issuer
pub async fn execute(
    redis_pool: &Arc<Pool>,
    oauth2_issuer: &OAuth2IssuerService,
    config: &Arc<Config>,
) -> Result<JwksEntity, String> {
    log::debug!("service:get_jwks:execute:start");

    let mut conn = redis_pool
        .get()
        .await
        .map_err(|e| format!("redis pool get error: {}", e))?;

    // 1. Try to get JWKS from Redis cache
    match jwks_redis_repository::get(&mut conn).await {
        Ok(Some(jwks)) => {
            log::debug!(
                "service:get_jwks:execute:cache_hit keys_count={}",
                jwks.keys.len()
            );
            return Ok(jwks);
        }
        Ok(None) => {
            log::debug!("service:get_jwks:execute:cache_miss");
        }
        Err(e) => {
            log::warn!("service:get_jwks:execute:cache_error err={}", e);
            // Continue to fetch from API even if cache read fails
        }
    }

    // 2. Fetch JWKS from OAuth2 issuer API
    let jwks = oauth2_issuer_api_repository::get_jwks(oauth2_issuer)
        .await
        .map_err(|e| format!("get_jwks failed: {}", e))?;

    log::debug!(
        "service:get_jwks:execute:fetched_from_api keys_count={}",
        jwks.keys.len()
    );

    // 3. Store JWKS in Redis cache
    let cache_expires = config
        .get_int("oauth2.jwks_cache_expires")
        .unwrap_or(DEFAULT_JWKS_CACHE_EXPIRES);

    if let Err(e) = jwks_redis_repository::set(&mut conn, &jwks, cache_expires).await {
        log::warn!("service:get_jwks:execute:cache_store_error err={}", e);
        // Continue even if cache store fails
    } else {
        log::debug!("service:get_jwks:execute:cached ttl={}", cache_expires);
    }

    Ok(jwks)
}

/// Force refresh JWKS from OAuth2 issuer (bypass cache)
/// Used when kid is not found in cached JWKS
pub async fn execute_force_refresh(
    redis_pool: &Arc<Pool>,
    oauth2_issuer: &OAuth2IssuerService,
    config: &Arc<Config>,
) -> Result<JwksEntity, String> {
    log::debug!("service:get_jwks:execute_force_refresh:start");

    // 1. Fetch JWKS from OAuth2 issuer API directly (bypass cache)
    let jwks = oauth2_issuer_api_repository::get_jwks(oauth2_issuer)
        .await
        .map_err(|e| format!("get_jwks failed: {}", e))?;

    log::debug!(
        "service:get_jwks:execute_force_refresh:fetched keys_count={}",
        jwks.keys.len()
    );

    // 2. Update Redis cache with fresh JWKS
    let cache_expires = config
        .get_int("oauth2.jwks_cache_expires")
        .unwrap_or(DEFAULT_JWKS_CACHE_EXPIRES);

    let mut conn = redis_pool
        .get()
        .await
        .map_err(|e| format!("redis pool get error: {}", e))?;

    if let Err(e) = jwks_redis_repository::set(&mut conn, &jwks, cache_expires).await {
        log::warn!("service:get_jwks:execute_force_refresh:cache_store_error err={}", e);
    } else {
        log::debug!("service:get_jwks:execute_force_refresh:cached ttl={}", cache_expires);
    }

    Ok(jwks)
}
