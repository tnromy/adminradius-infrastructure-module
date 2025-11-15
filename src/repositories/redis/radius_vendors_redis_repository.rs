use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::redis;
use tokio::time::Instant;

/// Create radius-vendors scope entry: key {prefix}:radius_vendors:{key_name} -> value_data with TTL (default 1800s)
pub async fn create<C: AsyncCommands>(
    conn: &mut C,
    key_prefix: &str,
    key_name: &str,
    value_data: &str,
    expire_seconds: Option<usize>,
) -> Result<String, redis::RedisError> {
    let ttl: usize = expire_seconds.unwrap_or(1800);
    let full_key = format!("{}:radius_vendors:{}", key_prefix, key_name);
    log::debug!("redis:radius_vendors:create:prepare key={} ttl={}", full_key, ttl);
    let start = Instant::now();
    let res: Result<(), redis::RedisError> = conn.set_ex(&full_key, value_data, ttl as u64).await;
    match res {
        Ok(_) => {
            log::debug!(
                "redis:radius_vendors:create:ok key={} elapsed_ms={}",
                full_key,
                start.elapsed().as_millis()
            );
            Ok(full_key)
        }
        Err(e) => {
            log::error!(
                "redis:radius_vendors:create:err key={} err={} elapsed_ms={}",
                full_key,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get stored scope for radius-vendors
pub async fn get<C: AsyncCommands>(
    conn: &mut C,
    key_prefix: &str,
    key_name: &str,
) -> Result<Option<String>, redis::RedisError> {
    let full_key = format!("{}:radius_vendors:{}", key_prefix, key_name);
    log::debug!("redis:radius_vendors:get:prepare key={}", full_key);
    let start = Instant::now();
    let res: Result<Option<String>, redis::RedisError> = conn.get(&full_key).await;
    match res {
        Ok(val_opt) => {
            log::debug!(
                "redis:radius_vendors:get:ok key={} hit={} elapsed_ms={}",
                full_key,
                val_opt.is_some(),
                start.elapsed().as_millis()
            );
            Ok(val_opt)
        }
        Err(e) => {
            log::error!(
                "redis:radius_vendors:get:err key={} err={} elapsed_ms={}",
                full_key,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Extend TTL for existing key
pub async fn extend_expires<C: AsyncCommands>(
    conn: &mut C,
    key_prefix: &str,
    key_name: &str,
    expire_seconds: usize,
) -> Result<bool, redis::RedisError> {
    let full_key = format!("{}:radius_vendors:{}", key_prefix, key_name);
    log::debug!(
        "redis:radius_vendors:extend_expires:prepare key={} new_ttl={}",
        full_key,
        expire_seconds
    );
    let start = Instant::now();
    let ttl_i64 = match i64::try_from(expire_seconds) {
        Ok(v) => v,
        Err(_) => {
            return Ok(false);
        }
    };
    let res: Result<bool, redis::RedisError> = conn.expire(&full_key, ttl_i64).await;
    match res {
        Ok(updated) => {
            log::debug!(
                "redis:radius_vendors:extend_expires:ok key={} updated={} elapsed_ms={}",
                full_key,
                updated,
                start.elapsed().as_millis()
            );
            Ok(updated)
        }
        Err(e) => {
            log::error!(
                "redis:radius_vendors:extend_expires:err key={} err={} elapsed_ms={}",
                full_key,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Delete radius-vendors key
pub async fn delete<C: AsyncCommands>(
    conn: &mut C,
    key_prefix: &str,
    key_name: &str,
) -> Result<bool, redis::RedisError> {
    let full_key = format!("{}:radius_vendors:{}", key_prefix, key_name);
    log::debug!("redis:radius_vendors:delete:prepare key={}", full_key);
    let start = Instant::now();
    let res: Result<u64, redis::RedisError> = conn.del(&full_key).await;
    match res {
        Ok(count) => {
            log::debug!(
                "redis:radius_vendors:delete:ok key={} deleted={} elapsed_ms={}",
                full_key,
                count,
                start.elapsed().as_millis()
            );
            Ok(count > 0)
        }
        Err(e) => {
            log::error!(
                "redis:radius_vendors:delete:err key={} err={} elapsed_ms={}",
                full_key,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}
