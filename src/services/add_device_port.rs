use chrono::Utc;
use serde_json::Value;
use thiserror::Error;

use crate::entities::device_port_entity::DevicePortEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_interface_postgres_repository as port_interface_repository;
use crate::repositories::postgresql::device_port_postgres_repository as device_port_repository;
use crate::repositories::postgresql::device_port_specification_postgres_repository as port_spec_repository;
use crate::repositories::postgresql::device_postgres_repository as device_repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDevicePortInput {
    pub device_id: String,
    pub port_type_id: String,
    pub port_specification_id: Option<String>,
    pub name: String,
    pub position: Option<i32>,
    pub enabled: bool,
    pub properties: Value,
}

#[derive(Debug, Error)]
pub enum AddDevicePortError {
    #[error("device not found")]
    DeviceNotFound,
    #[error("port type not found")]
    PortTypeNotFound,
    #[error("port specification not found")]
    PortSpecificationNotFound,
    #[error("port name already exists for device")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDevicePortInput,
) -> Result<DevicePortEntity, AddDevicePortError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if !device_repository::exists(conn, &input.device_id).await? {
        return Err(AddDevicePortError::DeviceNotFound);
    }

    if !port_interface_repository::exists(conn, &input.port_type_id).await? {
        return Err(AddDevicePortError::PortTypeNotFound);
    }

    if let Some(ref specification_id) = input.port_specification_id {
        if !port_spec_repository::exists(conn, specification_id).await? {
            return Err(AddDevicePortError::PortSpecificationNotFound);
        }
    }

    if device_port_repository::name_exists(conn, &input.device_id, &input.name, None).await? {
        return Err(AddDevicePortError::NameAlreadyExists);
    }

    let now = Utc::now();
    let entity = DevicePortEntity {
        id: uuid_helper::generate(),
        device_id: input.device_id,
        port_type_id: input.port_type_id,
        port_specification_id: input.port_specification_id,
        name: input.name,
        position: input.position,
        enabled: input.enabled,
        properties: input.properties,
        created_at: now,
        updated_at: now,
        device: None,
        port_type: None,
        port_specification: None,
    };

    device_port_repository::create(conn, &entity).await?;
    let created =
        device_port_repository::get_by_device_and_id(conn, &entity.device_id, &entity.id).await?;
    Ok(created.unwrap_or(entity))
}
