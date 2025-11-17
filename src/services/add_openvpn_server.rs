use chrono::Utc;
use thiserror::Error;

use crate::entities::openvpn_server_entity::OpenvpnServerEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::postgresql::openvpn_server_postgres_repository as repository;
use crate::services::get_openvpn_servers;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddOpenvpnServerInput {
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proto: String,
    pub cipher: Option<String>,
    pub auth_algorithm: String,
    pub tls_key_pem: Option<String>,
    pub tls_key_mode: Option<String>,
    pub ca_chain_pem: String,
    pub dh_pem: String,
    pub remote_cert_tls_name: String,
    pub crl_distribution_point: Option<String>,
}

#[derive(Debug, Error)]
pub enum AddOpenvpnServerError {
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
    input: AddOpenvpnServerInput,
) -> Result<OpenvpnServerEntity, AddOpenvpnServerError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Check name uniqueness
    if repository::name_exists(conn, &input.name, None).await? {
        return Err(AddOpenvpnServerError::NameAlreadyExists);
    }

    // Check host+port uniqueness
    if repository::host_port_exists(conn, &input.host, input.port, None).await? {
        return Err(AddOpenvpnServerError::HostPortAlreadyExists);
    }

    let now = Utc::now();
    let entity = OpenvpnServerEntity {
        id: uuid_helper::generate(),
        name: input.name,
        host: input.host,
        port: input.port,
        proto: input.proto,
        cipher: input.cipher,
        auth_algorithm: input.auth_algorithm,
        tls_key_pem: input.tls_key_pem,
        tls_key_mode: input.tls_key_mode,
        ca_chain_pem: input.ca_chain_pem,
        dh_pem: input.dh_pem,
        remote_cert_tls_name: input.remote_cert_tls_name,
        crl_distribution_point: input.crl_distribution_point,
        created_at: now,
        updated_at: now,
    };

    repository::create(conn, &entity).await?;

    // Refresh cache by calling get_openvpn_servers with is_cache = false
    let _ = get_openvpn_servers::execute(db, redis, false).await;

    Ok(entity)
}
