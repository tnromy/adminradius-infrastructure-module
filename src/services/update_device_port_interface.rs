use thiserror::Error;

use crate::entities::device_port_interface_entity::DevicePortInterfaceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_interface_postgres_repository as repository;

#[derive(Debug)]
pub struct UpdateDevicePortInterfaceInput {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Error)]
pub enum UpdateDevicePortInterfaceError {
    #[error("device port interface not found")]
    NotFound,
    #[error("device port interface name already exists")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDevicePortInterfaceInput,
) -> Result<DevicePortInterfaceEntity, UpdateDevicePortInterfaceError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::get_by_id(conn, &input.id).await?.is_none() {
        return Err(UpdateDevicePortInterfaceError::NotFound);
    }

    if repository::name_exists(conn, &input.name, Some(&input.id)).await? {
        return Err(UpdateDevicePortInterfaceError::NameAlreadyExists);
    }

    repository::update(conn, &input.id, &input.name).await?;

    let updated = repository::get_by_id(conn, &input.id).await?;
    updated.ok_or(UpdateDevicePortInterfaceError::NotFound)
}
