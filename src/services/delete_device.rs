use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_postgres_repository as device_repository;

#[derive(Debug, Error)]
pub enum DeleteDeviceError {
    #[error("device not found")]
    NotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    branch_id: &str,
    id: &str,
) -> Result<(), DeleteDeviceError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    let exists = device_repository::get_by_branch_and_id(conn, branch_id, id).await?;
    if exists.is_none() {
        return Err(DeleteDeviceError::NotFound);
    }

    let deleted = device_repository::delete(conn, id).await?;
    if deleted {
        Ok(())
    } else {
        Err(DeleteDeviceError::NotFound)
    }
}
