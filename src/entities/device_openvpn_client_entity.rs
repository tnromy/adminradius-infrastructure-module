use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Entity representing the association between a device and an OpenVPN client.
/// This is a 1:1 relationship - each device can have only one OpenVPN client and vice versa.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceOpenvpnClientEntity {
    pub id: String,
    pub device_id: String,
    pub openvpn_client_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
