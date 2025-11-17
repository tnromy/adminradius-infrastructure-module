use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::redis;
use tokio::time::Instant;

/// Create openvpn-servers list cache: key {prefix}:openvpn_servers:list -> value_data with TTL (default 3600s)
pub async fn create<C: AsyncCommands>(
    conn: &mut C,
    key_prefix: &str,
    value_data: &str,
    expire_seconds: Option<usize>,
) -> Result<String, redis::RedisError> {
    let ttl: usize = expire_seconds.unwrap_or(3600);
    let full_key = format!("{}:openvpn_servers:list", key_prefix);
    log::debug!("redis:openvpn_servers:create:prepare key={} ttl={}", full_key, ttl);
    let start = Instant::now();
    let res: Result<(), redis::RedisError> = conn.set_ex(&full_key, value_data, ttl as u64).await;
    match res {
        Ok(_) => {
            log::debug!(
                "redis:openvpn_servers:create:ok key={} elapsed_ms={}",
                full_key,
                start.elapsed().as_millis()
            );
            Ok(full_key)
        }
        Err(e) => {
            log::error!(
                "redis:openvpn_servers:create:err key={} err={} elapsed_ms={}",
                full_key,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get stored list for openvpn-servers
pub async fn get<C: AsyncCommands>(
    conn: &mut C,
    key_prefix: &str,
) -> Result<Option<String>, redis::RedisError> {
    let full_key = format!("{}:openvpn_servers:list", key_prefix);
    log::debug!("redis:openvpn_servers:get:prepare key={}", full_key);
    let start = Instant::now();
    let res: Result<Option<String>, redis::RedisError> = conn.get(&full_key).await;
    match res {
        Ok(val_opt) => {
            log::debug!(
                "redis:openvpn_servers:get:ok key={} hit={} elapsed_ms={}",
                full_key,
                val_opt.is_some(),
                start.elapsed().as_millis()
            );
            Ok(val_opt)
        }
        Err(e) => {
            log::error!(
                "redis:openvpn_servers:get:err key={} err={} elapsed_ms={}",
                full_key,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Delete openvpn-servers list cache
pub async fn delete<C: AsyncCommands>(
    conn: &mut C,
    key_prefix: &str,
) -> Result<bool, redis::RedisError> {
    let full_key = format!("{}:openvpn_servers:list", key_prefix);
    log::debug!("redis:openvpn_servers:delete:prepare key={}", full_key);
    let start = Instant::now();
    let res: Result<i32, redis::RedisError> = conn.del(&full_key).await;
    match res {
        Ok(count) => {
            log::debug!(
                "redis:openvpn_servers:delete:ok key={} count={} elapsed_ms={}",
                full_key,
                count,
                start.elapsed().as_millis()
            );
            Ok(count > 0)
        }
        Err(e) => {
            log::error!(
                "redis:openvpn_servers:delete:err key={} err={} elapsed_ms={}",
                full_key,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}
