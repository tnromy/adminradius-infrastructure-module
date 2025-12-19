use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::radius::RadiusService;
use crate::repositories::api::radius_api_repository;
use crate::repositories::postgresql::device_openvpn_client_postgres_repository;
use crate::repositories::postgresql::device_radius_client_postgres_repository;

#[derive(Debug)]
pub struct DeactivateDeviceRadiusClientInput {
    pub device_id: String,
}

#[derive(Debug, Error)]
pub enum DeactivateDeviceRadiusClientError {
    #[error("device has no OpenVPN client assigned")]
    NoOpenvpnClientAssigned,
    #[error("radius client not activated for this device")]
    NotActivated,
    #[error("radius API error: {0}")]
    RadiusApi(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    radius_service: &RadiusService,
    input: DeactivateDeviceRadiusClientInput,
) -> Result<(), DeactivateDeviceRadiusClientError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Step 1: Get device_openvpn_client by device_id
    let device_openvpn_client =
        device_openvpn_client_postgres_repository::find_by_device_id(conn, &input.device_id)
            .await?
            .ok_or(DeactivateDeviceRadiusClientError::NoOpenvpnClientAssigned)?;

    // Step 2: Get device_radius_client by device_openvpn_client_id
    let device_radius_client =
        device_radius_client_postgres_repository::find_by_device_openvpn_client_id(
            conn,
            &device_openvpn_client.id,
        )
        .await?
        .ok_or(DeactivateDeviceRadiusClientError::NotActivated)?;

    // Step 3: Get radius_client_id and call RADIUS API to delete
    let radius_client_id = device_radius_client.radius_client_id;
    
    radius_api_repository::delete_client(radius_service, radius_client_id)
        .await
        .map_err(|e| DeactivateDeviceRadiusClientError::RadiusApi(e.to_string()))?;

    log::debug!(
        "deactivate_device_radius_client:radius_api_deleted radius_client_id={} device_id={}",
        radius_client_id,
        input.device_id
    );

    // Step 4: After successful API deletion, delete from local database
    device_radius_client_postgres_repository::delete_by_device_openvpn_client_id(
        conn,
        &device_openvpn_client.id,
    )
    .await?;

    log::debug!(
        "deactivate_device_radius_client:db_deleted device_id={} radius_client_id={}",
        input.device_id,
        radius_client_id
    );

    Ok(())
}
