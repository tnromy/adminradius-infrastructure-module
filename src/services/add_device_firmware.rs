use chrono::Utc;
use thiserror::Error;

use crate::entities::device_firmware_entity::DeviceFirmwareEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_postgres_repository as repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDeviceFirmwareInput {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Error)]
pub enum AddDeviceFirmwareError {
    #[error("device firmware with same name and version already exists")]
    NameVersionAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDeviceFirmwareInput,
) -> Result<DeviceFirmwareEntity, AddDeviceFirmwareError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::name_version_exists(conn, &input.name, &input.version, None).await? {
        return Err(AddDeviceFirmwareError::NameVersionAlreadyExists);
    }

    let now = Utc::now();
    let entity = DeviceFirmwareEntity {
        id: uuid_helper::generate(),
        name: input.name,
        version: input.version,
        created_at: Some(now),
        updated_at: Some(now),
    };

    repository::create(conn, &entity).await?;

    Ok(entity)
}
