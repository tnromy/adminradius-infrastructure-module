use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_type_postgres_repository as repository;

#[derive(Debug, Error)]
pub enum DeleteDeviceTypeError {
    #[error("device type not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(db: &DatabaseConnection, id: &str) -> Result<(), DeleteDeviceTypeError> {
    let pool = db.get_pool();
    let deleted = repository::delete(pool.as_ref(), id).await?;

    if deleted {
        Ok(())
    } else {
        Err(DeleteDeviceTypeError::NotFound)
    }
}
