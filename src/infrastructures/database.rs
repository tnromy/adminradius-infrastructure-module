use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use config::Config;
use sqlx::{PgPool, postgres::PgPoolOptions};

#[derive(Clone)]
#[allow(dead_code)]
pub struct DatabaseConnection {
    pool: Arc<PgPool>,
}

#[allow(dead_code)]
impl DatabaseConnection {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: Arc::new(pool),
        }
    }

    pub fn get_pool(&self) -> Arc<PgPool> {
        self.pool.clone()
    }
}

pub async fn initialize_database(config: &Config) -> Result<DatabaseConnection> {
    let database_url = config
        .get_string("database_url")
        .or_else(|_| config.get_string("database.url"))
        .context("database_url is not configured")?;

    let max_connections = config
        .get_int("database.pool.max_connections")
        .unwrap_or(10)
        .max(1) as u32;

    let min_connections = config
        .get_int("database.pool.min_connections")
        .unwrap_or(1)
        .max(0) as u32;

    let connect_timeout = config
        .get_int("database.pool.connect_timeout_seconds")
        .unwrap_or(10);

    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(min_connections)
        .acquire_timeout(Duration::from_secs(connect_timeout as u64))
        .connect(&database_url)
        .await
        .with_context(|| "failed to connect to PostgreSQL")?;

    Ok(DatabaseConnection::new(pool))
}
