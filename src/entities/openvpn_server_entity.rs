use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Internal entity for OpenVPN server with all fields including sensitive data.
/// Use `OpenvpnServerResponse` for API responses to exclude sensitive fields.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OpenvpnServerEntity {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proto: String,
    pub cipher: Option<String>,
    pub auth_algorithm: String,
    pub tls_key_pem: Option<String>,
    pub tls_key_mode: Option<String>,
    /// CA certificate chain: Root CA + Intermediate CA (in that order)
    pub ca_chain_pem: String,
    /// The server's own certificate in PEM format
    pub certificate_pem: String,
    pub encrypted_private_key_pem: Option<String>,
    pub serial_number: i64,
    pub expired_at: DateTime<Utc>,
    pub remote_cert_tls_name: String,
    pub crl_distribution_point: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// API response struct for OpenVPN server that excludes sensitive fields.
/// This struct omits `encrypted_private_key_pem` from serialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenvpnServerResponse {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proto: String,
    pub cipher: Option<String>,
    pub auth_algorithm: String,
    pub tls_key_pem: Option<String>,
    pub tls_key_mode: Option<String>,
    /// CA certificate chain: Root CA + Intermediate CA (in that order)
    pub ca_chain_pem: String,
    /// The server's own certificate in PEM format
    pub certificate_pem: String,
    pub serial_number: i64,
    pub expired_at: DateTime<Utc>,
    pub remote_cert_tls_name: String,
    pub crl_distribution_point: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<OpenvpnServerEntity> for OpenvpnServerResponse {
    fn from(entity: OpenvpnServerEntity) -> Self {
        Self {
            id: entity.id,
            name: entity.name,
            host: entity.host,
            port: entity.port,
            proto: entity.proto,
            cipher: entity.cipher,
            auth_algorithm: entity.auth_algorithm,
            tls_key_pem: entity.tls_key_pem,
            tls_key_mode: entity.tls_key_mode,
            ca_chain_pem: entity.ca_chain_pem,
            certificate_pem: entity.certificate_pem,
            serial_number: entity.serial_number,
            expired_at: entity.expired_at,
            remote_cert_tls_name: entity.remote_cert_tls_name,
            crl_distribution_point: entity.crl_distribution_point,
            created_at: entity.created_at,
            updated_at: entity.updated_at,
        }
    }
}
