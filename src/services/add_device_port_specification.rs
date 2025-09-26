use chrono::Utc;
use serde_json::Value;
use thiserror::Error;

use crate::entities::device_port_specification_entity::DevicePortSpecificationEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_specification_postgres_repository as repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDevicePortSpecificationInput {
    pub name: String,
    pub data: Value,
}

#[derive(Debug, Error)]
pub enum AddDevicePortSpecificationError {
    #[error("device port specification name already exists")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDevicePortSpecificationInput,
) -> Result<DevicePortSpecificationEntity, AddDevicePortSpecificationError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::name_exists(conn, &input.name, None).await? {
        return Err(AddDevicePortSpecificationError::NameAlreadyExists);
    }

    let now = Utc::now();
    let entity = DevicePortSpecificationEntity {
        id: uuid_helper::generate(),
        name: input.name,
        data: input.data,
        created_at: now,
        updated_at: now,
    };

    repository::create(conn, &entity).await?;

    Ok(entity)
}
