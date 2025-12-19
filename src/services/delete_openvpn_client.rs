use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::postgresql::openvpn_client_postgres_repository as repository;
use crate::services::get_openvpn_clients;

#[derive(Debug, Error)]
pub enum DeleteOpenvpnClientError {
    #[error("openvpn client not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    redis: &RedisConnection,
    id: &str,
) -> Result<(), DeleteOpenvpnClientError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // First, get the client to know its server_id for cache invalidation
    let client = repository::find_by_id(conn, id)
        .await?
        .ok_or(DeleteOpenvpnClientError::NotFound)?;

    let server_id = client.server_id.clone();

    // Delete from database
    let deleted = repository::delete(conn, id).await?;

    if !deleted {
        return Err(DeleteOpenvpnClientError::NotFound);
    }

    log::debug!("delete_openvpn_client:deleted id={}", id);

    // Invalidate cache for this server's clients
    get_openvpn_clients::invalidate_cache(redis, &server_id).await;

    Ok(())
}
