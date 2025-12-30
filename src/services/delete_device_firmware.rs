use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_postgres_repository as repository;

#[derive(Debug, Error)]
pub enum DeleteDeviceFirmwareError {
    #[error("device firmware not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(db: &DatabaseConnection, id: &str) -> Result<(), DeleteDeviceFirmwareError> {
    let pool = db.get_pool();
    let deleted = repository::delete(pool.as_ref(), id).await?;

    if deleted {
        Ok(())
    } else {
        Err(DeleteDeviceFirmwareError::NotFound)
    }
}
