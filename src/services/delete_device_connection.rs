use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_connection_postgres_repository as connection_repository;

#[derive(Debug, Error)]
pub enum DeleteDeviceConnectionError {
    #[error("device connection not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    device_id: &str,
    id: &str,
) -> Result<(), DeleteDeviceConnectionError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    let exists = connection_repository::get_by_device_and_id(conn, device_id, id).await?;
    if exists.is_none() {
        return Err(DeleteDeviceConnectionError::NotFound);
    }

    let deleted = connection_repository::delete(conn, device_id, id).await?;
    if deleted {
        Ok(())
    } else {
        Err(DeleteDeviceConnectionError::NotFound)
    }
}
