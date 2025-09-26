use chrono::Utc;
use serde_json::Value;
use thiserror::Error;

use crate::entities::device_connection_entity::DeviceConnectionEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_connection_postgres_repository as connection_repository;
use crate::repositories::postgresql::device_port_postgres_repository as device_port_repository;
use crate::repositories::postgresql::device_postgres_repository as device_repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDeviceConnectionInput {
    pub device_id: String,
    pub from_port_id: String,
    pub to_port_id: String,
    pub details: Value,
}

#[derive(Debug, Error)]
pub enum AddDeviceConnectionError {
    #[error("device not found")]
    DeviceNotFound,
    #[error("from port not found")]
    FromPortNotFound,
    #[error("to port not found")]
    ToPortNotFound,
    #[error("ports must be different")]
    PortsMustBeDifferent,
    #[error("connection already exists")]
    ConnectionAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDeviceConnectionInput,
) -> Result<DeviceConnectionEntity, AddDeviceConnectionError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if !device_repository::exists(conn, &input.device_id).await? {
        return Err(AddDeviceConnectionError::DeviceNotFound);
    }

    if input.from_port_id == input.to_port_id {
        return Err(AddDeviceConnectionError::PortsMustBeDifferent);
    }

    if device_port_repository::get_by_device_and_id(conn, &input.device_id, &input.from_port_id)
        .await?
        .is_none()
    {
        return Err(AddDeviceConnectionError::FromPortNotFound);
    }

    if device_port_repository::get_by_device_and_id(conn, &input.device_id, &input.to_port_id)
        .await?
        .is_none()
    {
        return Err(AddDeviceConnectionError::ToPortNotFound);
    }

    if connection_repository::exists_by_ports(conn, &input.from_port_id, &input.to_port_id, None)
        .await?
    {
        return Err(AddDeviceConnectionError::ConnectionAlreadyExists);
    }

    let now = Utc::now();
    let entity = DeviceConnectionEntity {
        id: uuid_helper::generate(),
        from_port_id: input.from_port_id,
        to_port_id: input.to_port_id,
        details: input.details,
        created_at: now,
        updated_at: now,
        from_port: None,
        to_port: None,
    };

    connection_repository::create(conn, &entity).await?;
    let created =
        connection_repository::get_by_device_and_id(conn, &input.device_id, &entity.id).await?;

    Ok(created.unwrap_or(entity))
}
