use chrono::Utc;
use thiserror::Error;

use crate::entities::device_openvpn_client_entity::DeviceOpenvpnClientEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_openvpn_client_postgres_repository as assignment_repository;
use crate::repositories::postgresql::device_postgres_repository;
use crate::repositories::postgresql::openvpn_client_postgres_repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AssignDeviceOpenvpnClientInput {
    pub device_id: String,
    pub openvpn_client_id: String,
}

#[derive(Debug, Error)]
pub enum AssignDeviceOpenvpnClientError {
    #[error("device not found")]
    DeviceNotFound,
    #[error("device must be of type 'Router' to assign OpenVPN client")]
    DeviceNotRouter,
    #[error("openvpn client not found")]
    OpenvpnClientNotFound,
    #[error("device already has an OpenVPN client assigned")]
    DeviceAlreadyAssigned,
    #[error("openvpn client already assigned to another device")]
    OpenvpnClientAlreadyAssigned,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AssignDeviceOpenvpnClientInput,
) -> Result<DeviceOpenvpnClientEntity, AssignDeviceOpenvpnClientError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Step 1: Check device exists
    if !device_postgres_repository::exists(conn, &input.device_id).await? {
        return Err(AssignDeviceOpenvpnClientError::DeviceNotFound);
    }

    // Step 2: Check device is of type 'Router'
    if !device_postgres_repository::is_device_router(conn, &input.device_id).await? {
        return Err(AssignDeviceOpenvpnClientError::DeviceNotRouter);
    }

    // Step 3: Check openvpn_client exists
    if openvpn_client_postgres_repository::find_by_id(conn, &input.openvpn_client_id)
        .await?
        .is_none()
    {
        return Err(AssignDeviceOpenvpnClientError::OpenvpnClientNotFound);
    }

    // Step 4: Check device is not already assigned to another openvpn_client
    if assignment_repository::find_by_device_id(conn, &input.device_id)
        .await?
        .is_some()
    {
        return Err(AssignDeviceOpenvpnClientError::DeviceAlreadyAssigned);
    }

    // Step 5: Check openvpn_client is not already assigned to another device
    if assignment_repository::find_by_openvpn_client_id(conn, &input.openvpn_client_id)
        .await?
        .is_some()
    {
        return Err(AssignDeviceOpenvpnClientError::OpenvpnClientAlreadyAssigned);
    }

    // Step 6: Create the assignment entity
    let now = Utc::now();
    let entity = DeviceOpenvpnClientEntity {
        id: uuid_helper::generate(),
        device_id: input.device_id,
        openvpn_client_id: input.openvpn_client_id,
        created_at: now,
        updated_at: now,
    };

    // Step 7: Save to repository
    assignment_repository::create(conn, &entity).await?;

    log::debug!(
        "assign_device_openvpn_client:created id={} device_id={} openvpn_client_id={}",
        entity.id,
        entity.device_id,
        entity.openvpn_client_id
    );

    Ok(entity)
}
