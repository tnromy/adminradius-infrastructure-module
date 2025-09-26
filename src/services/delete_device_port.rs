use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_postgres_repository as device_port_repository;

#[derive(Debug, Error)]
pub enum DeleteDevicePortError {
    #[error("device port not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    device_id: &str,
    id: &str,
) -> Result<(), DeleteDevicePortError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    let exists = device_port_repository::get_by_device_and_id(conn, device_id, id).await?;
    if exists.is_none() {
        return Err(DeleteDevicePortError::NotFound);
    }

    let deleted = device_port_repository::delete(conn, device_id, id).await?;
    if deleted {
        Ok(())
    } else {
        Err(DeleteDevicePortError::NotFound)
    }
}
