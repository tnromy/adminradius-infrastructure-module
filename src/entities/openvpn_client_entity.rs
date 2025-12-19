use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Internal entity for OpenVPN client with all fields including sensitive data.
/// Use `OpenvpnClientResponse` for API responses to exclude sensitive fields.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OpenvpnClientEntity {
    pub id: String,
    pub server_id: String,
    /// Common Name for the client certificate
    pub cn: String,
    /// Reserved IP address assigned by CA (optional)
    pub reserved_ip_address: Option<String>,
    /// The client's certificate in PEM format
    pub certificate_pem: String,
    /// Encrypted private key in PEM format
    pub encrypted_private_key_pem: String,
    /// Revocation timestamp (None if not revoked)
    pub revoked_at: Option<DateTime<Utc>>,
    /// Certificate expiration timestamp
    pub expired_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// API response struct for OpenVPN client that excludes sensitive fields.
/// This struct omits `encrypted_private_key_pem` from serialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenvpnClientResponse {
    pub id: String,
    pub server_id: String,
    /// Common Name for the client certificate
    pub cn: String,
    /// Reserved IP address assigned by CA (optional)
    pub reserved_ip_address: Option<String>,
    /// The client's certificate in PEM format
    pub certificate_pem: String,
    /// Revocation timestamp (None if not revoked)
    pub revoked_at: Option<DateTime<Utc>>,
    /// Certificate expiration timestamp
    pub expired_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<OpenvpnClientEntity> for OpenvpnClientResponse {
    fn from(entity: OpenvpnClientEntity) -> Self {
        Self {
            id: entity.id,
            server_id: entity.server_id,
            cn: entity.cn,
            reserved_ip_address: entity.reserved_ip_address,
            certificate_pem: entity.certificate_pem,
            revoked_at: entity.revoked_at,
            expired_at: entity.expired_at,
            created_at: entity.created_at,
            updated_at: entity.updated_at,
        }
    }
}
