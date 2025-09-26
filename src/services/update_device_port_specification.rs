use serde_json::Value;
use thiserror::Error;

use crate::entities::device_port_specification_entity::DevicePortSpecificationEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_specification_postgres_repository as repository;

#[derive(Debug)]
pub struct UpdateDevicePortSpecificationInput {
    pub id: String,
    pub name: String,
    pub data: Value,
}

#[derive(Debug, Error)]
pub enum UpdateDevicePortSpecificationError {
    #[error("device port specification not found")]
    NotFound,
    #[error("device port specification name already exists")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDevicePortSpecificationInput,
) -> Result<DevicePortSpecificationEntity, UpdateDevicePortSpecificationError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::get_by_id(conn, &input.id).await?.is_none() {
        return Err(UpdateDevicePortSpecificationError::NotFound);
    }

    if repository::name_exists(conn, &input.name, Some(&input.id)).await? {
        return Err(UpdateDevicePortSpecificationError::NameAlreadyExists);
    }

    repository::update(conn, &input.id, &input.name, &input.data).await?;

    let updated = repository::get_by_id(conn, &input.id).await?;
    updated.ok_or(UpdateDevicePortSpecificationError::NotFound)
}
