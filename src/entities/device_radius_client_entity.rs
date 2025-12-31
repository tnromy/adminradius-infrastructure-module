use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Entity representing the association between a device (via device_openvpn_client) and a RADIUS client.
/// This is a 1:1 relationship - each device_openvpn_client can have only one RADIUS client.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceRadiusClientEntity {
    pub id: String,
    pub device_openvpn_client_id: String,
    pub radius_client_id: i32,
    pub encrypted_secret: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// API response struct for Device RADIUS Client that returns decrypted secret.
/// The database stores encrypted_secret, but API returns plaintext secret.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceRadiusClientResponse {
    pub id: String,
    pub device_openvpn_client_id: String,
    pub radius_client_id: i32,
    /// Decrypted secret (plaintext)
    pub secret: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl DeviceRadiusClientResponse {
    /// Create response from entity and decrypted secret
    pub fn from_entity_with_secret(entity: DeviceRadiusClientEntity, secret: String) -> Self {
        Self {
            id: entity.id,
            device_openvpn_client_id: entity.device_openvpn_client_id,
            radius_client_id: entity.radius_client_id,
            secret,
            created_at: entity.created_at,
            updated_at: entity.updated_at,
        }
    }
}
