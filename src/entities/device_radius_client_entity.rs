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
