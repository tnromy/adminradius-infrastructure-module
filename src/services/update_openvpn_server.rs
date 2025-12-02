use thiserror::Error;

use crate::entities::openvpn_server_entity::OpenvpnServerEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::postgresql::openvpn_server_postgres_repository as repository;
use crate::services::get_openvpn_servers;

#[derive(Debug)]
pub struct UpdateOpenvpnServerInput {
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
    pub remote_cert_tls_name: String,
    pub crl_distribution_point: Option<String>,
}

#[derive(Debug, Error)]
pub enum UpdateOpenvpnServerError {
    #[error("openvpn server not found")]
    NotFound,
    #[error("openvpn server name already exists")]
    NameAlreadyExists,
    #[error("openvpn server host and port combination already exists")]
    HostPortAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    redis: &RedisConnection,
    input: UpdateOpenvpnServerInput,
) -> Result<OpenvpnServerEntity, UpdateOpenvpnServerError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Check if exists
    if repository::get_by_id(conn, &input.id).await?.is_none() {
        return Err(UpdateOpenvpnServerError::NotFound);
    }

    // Check name uniqueness (excluding current ID)
    if repository::name_exists(conn, &input.name, Some(&input.id)).await? {
        return Err(UpdateOpenvpnServerError::NameAlreadyExists);
    }

    // Check host+port uniqueness (excluding current ID)
    if repository::host_port_exists(conn, &input.host, input.port, Some(&input.id)).await? {
        return Err(UpdateOpenvpnServerError::HostPortAlreadyExists);
    }

    repository::update(
        conn,
        &input.id,
        &input.name,
        &input.host,
        input.port,
        &input.proto,
        input.cipher.as_deref(),
        &input.auth_algorithm,
        input.tls_key_pem.as_deref(),
        input.tls_key_mode.as_deref(),
        &input.ca_chain_pem,
        &input.remote_cert_tls_name,
        input.crl_distribution_point.as_deref(),
    )
    .await?;

    let updated = repository::get_by_id(conn, &input.id).await?;

    // Refresh cache by calling get_openvpn_servers with is_cache = false
    let _ = get_openvpn_servers::execute(db, redis, false).await;

    updated.ok_or(UpdateOpenvpnServerError::NotFound)
}
