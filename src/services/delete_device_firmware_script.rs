use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_script_postgres_repository as repository;

#[derive(Debug, Error)]
pub enum DeleteDeviceFirmwareScriptError {
    #[error("device firmware script not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(db: &DatabaseConnection, id: &str) -> Result<(), DeleteDeviceFirmwareScriptError> {
    let pool = db.get_pool();
    let deleted = repository::delete(pool.as_ref(), id).await?;

    if deleted {
        Ok(())
    } else {
        Err(DeleteDeviceFirmwareScriptError::NotFound)
    }
}
