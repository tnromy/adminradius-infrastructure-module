use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::redis;
use tokio::time::Instant;

use crate::entities::jwks_entity::JwksEntity;

const KEY: &str = "jwks";

/// Store JWKS in Redis with TTL
pub async fn set<C: AsyncCommands>(
    conn: &mut C,
    jwks: &JwksEntity,
    expire_seconds: i64,
) -> Result<(), redis::RedisError> {
    log::debug!("redis:jwks:set key={} ttl={}", KEY, expire_seconds);

    let start = Instant::now();
    let jwks_json = serde_json::to_string(jwks).unwrap_or_default();

    let res: Result<(), redis::RedisError> = conn
        .set_ex(KEY, &jwks_json, expire_seconds as u64)
        .await;

    match res {
        Ok(_) => {
            log::debug!(
                "redis:jwks:set:ok key={} elapsed_ms={}",
                KEY,
                start.elapsed().as_millis()
            );
            Ok(())
        }
        Err(e) => {
            log::error!(
                "redis:jwks:set:err key={} err={} elapsed_ms={}",
                KEY,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get JWKS from Redis
/// Returns Some(JwksEntity) if found, None if not found
pub async fn get<C: AsyncCommands>(
    conn: &mut C,
) -> Result<Option<JwksEntity>, redis::RedisError> {
    log::debug!("redis:jwks:get key={}", KEY);

    let start = Instant::now();
    let res: Result<Option<String>, _> = conn.get(KEY).await;

    match res {
        Ok(val) => {
            log::debug!(
                "redis:jwks:get:ok key={} hit={} elapsed_ms={}",
                KEY,
                val.is_some(),
                start.elapsed().as_millis()
            );
            match val {
                Some(json_str) => {
                    let jwks: JwksEntity = serde_json::from_str(&json_str)
                        .map_err(|e| {
                            redis::RedisError::from((
                                redis::ErrorKind::TypeError,
                                "failed to parse jwks json",
                                e.to_string(),
                            ))
                        })?;
                    Ok(Some(jwks))
                }
                None => Ok(None),
            }
        }
        Err(e) => {
            log::error!(
                "redis:jwks:get:err key={} err={} elapsed_ms={}",
                KEY,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}
