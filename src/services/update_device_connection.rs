use chrono::Utc;
use serde_json::Value;
use thiserror::Error;

use crate::entities::device_connection_entity::DeviceConnectionEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_connection_postgres_repository as connection_repository;
use crate::repositories::postgresql::device_port_postgres_repository as device_port_repository;
use crate::repositories::postgresql::device_postgres_repository as device_repository;

#[derive(Debug)]
pub struct UpdateDeviceConnectionInput {
    pub id: String,
    pub device_id: String,
    pub from_port_id: String,
    pub to_port_id: String,
    pub details: Value,
}

#[derive(Debug, Error)]
pub enum UpdateDeviceConnectionError {
    #[error("device not found")]
    DeviceNotFound,
    #[error("device connection not found")]
    ConnectionNotFound,
    #[error("from port not found")]
    FromPortNotFound,
    #[error("to port not found")]
    ToPortNotFound,
    #[error("ports must be different")]
    PortsMustBeDifferent,
    #[error("source and destination ports cannot belong to the same device")]
    PortsOnSameDevice,
    #[error("source and destination ports must be within the same branch")]
    BranchMismatch,
    #[error("connection already exists")]
    ConnectionAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDeviceConnectionInput,
) -> Result<DeviceConnectionEntity, UpdateDeviceConnectionError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    let Some(from_device) = device_repository::get_by_id(conn, &input.device_id).await? else {
        return Err(UpdateDeviceConnectionError::DeviceNotFound);
    };

    let existing =
        connection_repository::get_by_device_and_id(conn, &input.device_id, &input.id).await?;
    let existing = if let Some(existing) = existing {
        existing
    } else {
        return Err(UpdateDeviceConnectionError::ConnectionNotFound);
    };

    if input.from_port_id == input.to_port_id {
        return Err(UpdateDeviceConnectionError::PortsMustBeDifferent);
    }

    let Some(from_port) =
        device_port_repository::get_by_device_and_id(conn, &input.device_id, &input.from_port_id)
            .await?
    else {
        return Err(UpdateDeviceConnectionError::FromPortNotFound);
    };

    if from_port.device_id != from_device.id {
        return Err(UpdateDeviceConnectionError::FromPortNotFound);
    }

    let Some(to_port) = device_port_repository::get_by_id(conn, &input.to_port_id).await? else {
        return Err(UpdateDeviceConnectionError::ToPortNotFound);
    };

    if to_port.device_id == from_device.id {
        return Err(UpdateDeviceConnectionError::PortsOnSameDevice);
    }

    let Some(to_device) = device_repository::get_by_id(conn, &to_port.device_id).await? else {
        return Err(UpdateDeviceConnectionError::ToPortNotFound);
    };

    if to_device.branch_id != from_device.branch_id {
        return Err(UpdateDeviceConnectionError::BranchMismatch);
    }

    if connection_repository::exists_by_ports(
        conn,
        &input.from_port_id,
        &input.to_port_id,
        Some(&input.id),
    )
    .await?
    {
        return Err(UpdateDeviceConnectionError::ConnectionAlreadyExists);
    }

    let entity = DeviceConnectionEntity {
        id: input.id.clone(),
        from_port_id: input.from_port_id,
        to_port_id: input.to_port_id,
        details: input.details,
        created_at: existing.created_at,
        updated_at: Utc::now(),
        from_port: None,
        to_port: None,
    };

    if !connection_repository::update(conn, &entity).await? {
        return Err(UpdateDeviceConnectionError::ConnectionNotFound);
    }

    if let Some(updated) =
        connection_repository::get_by_device_and_id(conn, &input.device_id, &entity.id).await?
    {
        Ok(updated)
    } else {
        // Fallback to entity with updated timestamp if refetch fails unexpectedly.
        Ok(entity)
    }
}
