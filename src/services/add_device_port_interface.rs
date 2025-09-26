use chrono::Utc;
use thiserror::Error;

use crate::entities::device_port_interface_entity::DevicePortInterfaceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_interface_postgres_repository as repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDevicePortInterfaceInput {
    pub name: String,
}

#[derive(Debug, Error)]
pub enum AddDevicePortInterfaceError {
    #[error("device port interface name already exists")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDevicePortInterfaceInput,
) -> Result<DevicePortInterfaceEntity, AddDevicePortInterfaceError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if repository::name_exists(conn, &input.name, None).await? {
        return Err(AddDevicePortInterfaceError::NameAlreadyExists);
    }

    let now = Utc::now();
    let entity = DevicePortInterfaceEntity {
        id: uuid_helper::generate(),
        name: input.name,
        created_at: now,
        updated_at: now,
    };

    repository::create(conn, &entity).await?;

    Ok(entity)
}
