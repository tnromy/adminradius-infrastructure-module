use thiserror::Error;

use crate::entities::device_type_entity::DeviceTypeEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_type_postgres_repository as repository;

#[derive(Debug)]
pub struct UpdateDeviceTypeInput {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Error)]
pub enum UpdateDeviceTypeError {
    #[error("device type not found")]
    NotFound,
    #[error("device type name already exists")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDeviceTypeInput,
) -> Result<DeviceTypeEntity, UpdateDeviceTypeError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::get_by_id(conn, &input.id).await?.is_none() {
        return Err(UpdateDeviceTypeError::NotFound);
    }

    if repository::name_exists(conn, &input.name, Some(&input.id)).await? {
        return Err(UpdateDeviceTypeError::NameAlreadyExists);
    }

    repository::update(conn, &input.id, &input.name).await?;

    let updated = repository::get_by_id(conn, &input.id).await?;
    updated.ok_or(UpdateDeviceTypeError::NotFound)
}
