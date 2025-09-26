use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result, anyhow};
use config::Config;
use deadpool::managed::PoolConfig;
use deadpool_redis::{CreatePoolError, Pool};
use url::Url;

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
    let host = config
        .get_string("redis.host")
        .context("redis.host is not configured")?;
    let port = config
        .get_int("redis.port")
        .unwrap_or(6379)
        .clamp(1, u16::MAX as i64) as u16;

    let mut redis_url = Url::parse(&format!("redis://{}:{}/", host, port))
        .context("failed to construct redis url")?;

    if let Ok(password) = config.get_string("redis.password") {
        if !password.is_empty() {
            redis_url
                .set_password(Some(&password))
                .map_err(|_| anyhow!("invalid redis password"))?;
        }
    }

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

    let mut cfg = deadpool_redis::Config::default();
    cfg.url = Some(redis_url.to_string());
    let mut pool_config = PoolConfig::default();
    pool_config.max_size = max_connections;
    cfg.pool = Some(pool_config);

    let pool = cfg
        .create_pool(Some(deadpool_redis::Runtime::Tokio1))
        .map_err(map_pool_error)?;

    Ok(RedisConnection::new(
        pool,
        Duration::from_secs(response_timeout),
        Duration::from_secs(retry_max_delay),
    ))
}

fn map_pool_error(err: CreatePoolError) -> anyhow::Error {
    anyhow::Error::new(err)
}
