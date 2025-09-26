use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use config::Config;
use deadpool::managed::{PoolConfig, QueueMode};
use deadpool_redis::{CreatePoolError, Pool};
use tokio::time::timeout;
use urlencoding::encode; // ensure special chars (e.g. '@') in password are encoded

#[derive(Clone)]
#[allow(dead_code)]
pub struct RedisConnection {
    pool: Arc<Pool>,
    response_timeout: Duration,
    retry_max_delay: Duration,
}

#[allow(dead_code)]
impl RedisConnection {
    pub fn new(pool: Pool, response_timeout: Duration, retry_max_delay: Duration) -> Self {
        Self {
            pool: Arc::new(pool),
            response_timeout,
            retry_max_delay,
        }
    }

    pub fn pool(&self) -> Arc<Pool> {
        self.pool.clone()
    }

    pub fn response_timeout(&self) -> Duration {
        self.response_timeout
    }

    pub fn retry_max_delay(&self) -> Duration {
        self.retry_max_delay
    }
}

pub async fn initialize_redis(config: &Config) -> Result<RedisConnection> {
    // Basic configuration extraction
    let host = config
        .get_string("redis.host")
        .context("redis.host is not configured")?;
    let port = config
        .get_int("redis.port")
        .unwrap_or(6379)
        .clamp(1, u16::MAX as i64) as u16;
    let password = config.get_string("redis.password").unwrap_or_default();

    let max_connections = config
        .get_int("redis.pool.max_connections")
        .unwrap_or(10)
        .max(1) as usize;
    let response_timeout = config
        .get_int("redis.pool.response_timeout_seconds")
        .unwrap_or(30)
        .max(1) as u64;
    let retry_max_delay = config
        .get_int("redis.pool.retry_max_delay_seconds")
        .unwrap_or(1)
        .max(1) as u64;
    let connection_timeout_secs = config
        .get_int("redis.pool.connection_timeout_seconds")
        .unwrap_or(10)
        .max(1) as u64;

    // Build URL explicitly. Use DB 0 by default.
    // Encode password to safely include special characters like '@'.
    let url = if password.is_empty() {
        format!("redis://{}:{}/0", host, port)
    } else {
        format!("redis://:{}@{}:{}/0", encode(&password), host, port)
    };

    log::debug!(
        "redis:init host={} port={} has_password={} url=***", // do not log full URL with password
        host,
        port,
        !password.is_empty()
    );

    // Use from_url to avoid having both `connection` and `url` set which causes runtime panic.
    let mut cfg = deadpool_redis::Config::from_url(url);
    cfg.pool = Some(PoolConfig {
        max_size: max_connections,
        queue_mode: QueueMode::Fifo,
        timeouts: deadpool_redis::Timeouts::default(),
    });

    // create_pool is sync; wrap in a future to apply a timeout if desired for symmetry.
    let pool_result = timeout(
        Duration::from_secs(connection_timeout_secs),
        async { cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1)) },
    )
    .await
    .map_err(|_| anyhow!("Redis pool creation timeout after {}s", connection_timeout_secs))?; // timeout layer

    let pool = pool_result.map_err(map_pool_error)?; // underlying pool creation error mapping

    // Health check PING with the same timeout semantics.
    timeout(Duration::from_secs(response_timeout), async {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow!("Redis get connection failed: {}", e))?;
        let reply: String = deadpool_redis::redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .map_err(|e| anyhow!("Redis PING failed: {}", e))?;
        if reply.to_uppercase() != "PONG" {
            return Err(anyhow!("Unexpected PING reply: {}", reply));
        }
        Ok::<_, anyhow::Error>(())
    })
    .await
    .map_err(|_| anyhow!("Redis PING timeout after {}s", response_timeout))??;

    log::info!("redis initialized and ping ok");

    Ok(RedisConnection::new(
        pool,
        Duration::from_secs(response_timeout),
        Duration::from_secs(retry_max_delay),
    ))
}

fn map_pool_error(err: CreatePoolError) -> anyhow::Error {
    anyhow::Error::new(err)
}
