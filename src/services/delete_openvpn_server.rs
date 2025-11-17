use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::postgresql::openvpn_server_postgres_repository as repository;
use crate::services::get_openvpn_servers;

#[derive(Debug, Error)]
pub enum DeleteOpenvpnServerError {
    #[error("openvpn server not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    redis: &RedisConnection,
    id: &str,
) -> Result<(), DeleteOpenvpnServerError> {
    let pool = db.get_pool();
    let deleted = repository::delete(pool.as_ref(), id).await?;

    if deleted {
        // Refresh cache by calling get_openvpn_servers with is_cache = false
        let _ = get_openvpn_servers::execute(db, redis, false).await;
        Ok(())
    } else {
        Err(DeleteOpenvpnServerError::NotFound)
    }
}
