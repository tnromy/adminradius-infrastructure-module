use chrono::Utc;
use config::Config;
use thiserror::Error;

use crate::entities::device_radius_client_entity::DeviceRadiusClientEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::radius::RadiusService;
use crate::repositories::api::radius_api_repository::{self, AddRadiusClientRequest};
use crate::repositories::postgresql::device_openvpn_client_postgres_repository;
use crate::repositories::postgresql::device_postgres_repository;
use crate::repositories::postgresql::device_radius_client_postgres_repository;
use crate::repositories::postgresql::openvpn_client_postgres_repository;
use crate::utils::crypt_helper;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct ActivateDeviceRadiusClientInput {
    pub device_id: String,
    pub device_vendor_id: i32,
}

#[derive(Debug)]
pub struct ActivateDeviceRadiusClientResult {
    pub entity: DeviceRadiusClientEntity,
    pub secret: String,
}

#[derive(Debug, Error)]
pub enum ActivateDeviceRadiusClientError {
    #[error("device not found")]
    DeviceNotFound,
    #[error("device has no OpenVPN client assigned")]
    NoOpenvpnClientAssigned,
    #[error("OpenVPN client not found")]
    OpenvpnClientNotFound,
    #[error("OpenVPN client has no reserved IP address")]
    NoReservedIpAddress,
    #[error("radius client already activated for this device")]
    AlreadyActivated,
    #[error("configuration error: {0}")]
    Config(String),
    #[error("radius API error: {0}")]
    RadiusApi(String),
    #[error("encryption error: {0}")]
    Encryption(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    config: &Config,
    radius_service: &RadiusService,
    input: ActivateDeviceRadiusClientInput,
) -> Result<ActivateDeviceRadiusClientResult, ActivateDeviceRadiusClientError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Step 1: Check device exists and get device name
    let device = device_postgres_repository::get_by_id(conn, &input.device_id)
        .await?
        .ok_or(ActivateDeviceRadiusClientError::DeviceNotFound)?;

    // Step 2: Get device_openvpn_client assignment
    let device_openvpn_client =
        device_openvpn_client_postgres_repository::find_by_device_id(conn, &input.device_id)
            .await?
            .ok_or(ActivateDeviceRadiusClientError::NoOpenvpnClientAssigned)?;

    // Step 3: Check if radius client is already activated
    if device_radius_client_postgres_repository::find_by_device_openvpn_client_id(
        conn,
        &device_openvpn_client.id,
    )
    .await?
    .is_some()
    {
        return Err(ActivateDeviceRadiusClientError::AlreadyActivated);
    }

    // Step 4: Get OpenVPN client to get reserved_ip_address
    let openvpn_client = openvpn_client_postgres_repository::find_by_id(
        conn,
        &device_openvpn_client.openvpn_client_id,
    )
    .await?
    .ok_or(ActivateDeviceRadiusClientError::OpenvpnClientNotFound)?;

    // Step 5: Get reserved IP address (required for RADIUS host)
    let host = openvpn_client
        .reserved_ip_address
        .ok_or(ActivateDeviceRadiusClientError::NoReservedIpAddress)?;

    // Step 6: Generate secret for RADIUS client
    let secret = uuid_helper::generate();

    // Step 7: Get passphrase from config
    let passphrase = config
        .get_string("radius.default_passphrase")
        .map_err(|e| {
            ActivateDeviceRadiusClientError::Config(format!(
                "Failed to get radius.default_passphrase: {}",
                e
            ))
        })?;

    // Step 8: Call RADIUS API to add client
    let add_request = AddRadiusClientRequest {
        host: host.clone(),
        name: device.name.clone(),
        secret: secret.clone(),
        description: format!("Device: {}", device.name),
        vendor_id: input.device_vendor_id,
    };

    let add_response = radius_api_repository::add_client(radius_service, &add_request)
        .await
        .map_err(|e| ActivateDeviceRadiusClientError::RadiusApi(e.to_string()))?;

    log::debug!(
        "activate_device_radius_client:radius_api_created radius_client_id={} device_id={}",
        add_response.id,
        input.device_id
    );

    // Step 9: Encrypt secret
    let encrypted_secret = crypt_helper::encrypt_string(&secret, &passphrase)
        .map_err(|e| ActivateDeviceRadiusClientError::Encryption(e))?;

    // Step 10: Create entity
    let now = Utc::now();
    let entity = DeviceRadiusClientEntity {
        id: uuid_helper::generate(),
        device_openvpn_client_id: device_openvpn_client.id.clone(),
        radius_client_id: add_response.id,
        encrypted_secret,
        created_at: now,
        updated_at: now,
    };

    // Step 11: Save to database
    device_radius_client_postgres_repository::create(conn, &entity).await?;

    log::debug!(
        "activate_device_radius_client:created id={} device_id={} radius_client_id={}",
        entity.id,
        input.device_id,
        entity.radius_client_id
    );

    // Step 12: Return entity with plaintext secret
    Ok(ActivateDeviceRadiusClientResult {
        entity,
        secret,
    })
}
