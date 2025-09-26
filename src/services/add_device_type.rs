use chrono::Utc;
use thiserror::Error;

use crate::entities::device_type_entity::DeviceTypeEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_type_postgres_repository as repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDeviceTypeInput {
    pub name: String,
}

#[derive(Debug, Error)]
pub enum AddDeviceTypeError {
    #[error("device type name already exists")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDeviceTypeInput,
) -> Result<DeviceTypeEntity, AddDeviceTypeError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::name_exists(conn, &input.name, None).await? {
        return Err(AddDeviceTypeError::NameAlreadyExists);
    }

    let now = Utc::now();
    let entity = DeviceTypeEntity {
        id: uuid_helper::generate(),
        name: input.name,
        created_at: now,
        updated_at: now,
    };

    repository::create(conn, &entity).await?;

    Ok(entity)
}
