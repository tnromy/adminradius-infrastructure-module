use chrono::Utc;
use serde_json::Value;
use thiserror::Error;

use crate::entities::device_port_entity::DevicePortEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_interface_postgres_repository as port_interface_repository;
use crate::repositories::postgresql::device_port_postgres_repository as device_port_repository;
use crate::repositories::postgresql::device_port_specification_postgres_repository as port_spec_repository;
use crate::repositories::postgresql::device_postgres_repository as device_repository;

#[derive(Debug)]
pub struct UpdateDevicePortInput {
    pub id: String,
    pub device_id: String,
    pub port_interface_id: String,
    pub port_specification_id: Option<String>,
    pub name: String,
    pub position: Option<i32>,
    pub enabled: bool,
    pub properties: Value,
}

#[derive(Debug, Error)]
pub enum UpdateDevicePortError {
    #[error("device not found")]
    DeviceNotFound,
    #[error("device port not found")]
    PortNotFound,
    #[error("port interface not found")]
    PortInterfaceNotFound,
    #[error("port specification not found")]
    PortSpecificationNotFound,
    #[error("port name already exists for device")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDevicePortInput,
) -> Result<DevicePortEntity, UpdateDevicePortError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if !device_repository::exists(conn, &input.device_id).await? {
        return Err(UpdateDevicePortError::DeviceNotFound);
    }

    if !port_interface_repository::exists(conn, &input.port_interface_id).await? {
        return Err(UpdateDevicePortError::PortInterfaceNotFound);
    }

    if let Some(ref specification_id) = input.port_specification_id {
        if !port_spec_repository::exists(conn, specification_id).await? {
            return Err(UpdateDevicePortError::PortSpecificationNotFound);
        }
    }

    let Some(existing) =
        device_port_repository::get_by_device_and_id(conn, &input.device_id, &input.id).await?
    else {
        return Err(UpdateDevicePortError::PortNotFound);
    };

    if device_port_repository::name_exists(conn, &input.device_id, &input.name, Some(&input.id))
        .await?
    {
        return Err(UpdateDevicePortError::NameAlreadyExists);
    }

    let entity = DevicePortEntity {
        id: existing.id,
        device_id: input.device_id,
        port_interface_id: input.port_interface_id,
        port_specification_id: input.port_specification_id,
        name: input.name,
        position: input.position,
        enabled: input.enabled,
        properties: input.properties,
        created_at: existing.created_at,
        updated_at: Utc::now(),
        device: None,
        port_interface: None,
        port_specification: None,
    };

    device_port_repository::update(conn, &entity).await?;
    let refreshed =
        device_port_repository::get_by_device_and_id(conn, &entity.device_id, &entity.id).await?;
    Ok(refreshed.unwrap_or(entity))
}
