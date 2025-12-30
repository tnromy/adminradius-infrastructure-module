use thiserror::Error;

use crate::entities::device_firmware_entity::DeviceFirmwareEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_postgres_repository as repository;

#[derive(Debug)]
pub struct UpdateDeviceFirmwareInput {
    pub id: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Error)]
pub enum UpdateDeviceFirmwareError {
    #[error("device firmware not found")]
    NotFound,
    #[error("device firmware with same name and version already exists")]
    NameVersionAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDeviceFirmwareInput,
) -> Result<DeviceFirmwareEntity, UpdateDeviceFirmwareError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::get_by_id(conn, &input.id).await?.is_none() {
        return Err(UpdateDeviceFirmwareError::NotFound);
    }

    if repository::name_version_exists(conn, &input.name, &input.version, Some(&input.id)).await? {
        return Err(UpdateDeviceFirmwareError::NameVersionAlreadyExists);
    }

    repository::update(conn, &input.id, &input.name, &input.version).await?;

    let updated = repository::get_by_id(conn, &input.id).await?;
    updated.ok_or(UpdateDeviceFirmwareError::NotFound)
}
