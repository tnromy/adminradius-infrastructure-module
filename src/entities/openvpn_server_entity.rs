use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

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
    pub ca_chain_pem: String,
    pub encrypted_private_key_pem: Option<String>,
    pub remote_cert_tls_name: String,
    pub crl_distribution_point: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
