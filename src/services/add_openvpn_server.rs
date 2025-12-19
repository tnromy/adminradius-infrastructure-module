use chrono::{DateTime, Utc};
use config::Config;
use thiserror::Error;

use crate::entities::openvpn_server_entity::OpenvpnServerEntity;
use crate::entities::root_ca_entity;
use crate::infrastructures::ca_openvpn::CaOpenvpnService;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::api::ca_openvpn_api_repository;
use crate::repositories::postgresql::openvpn_server_postgres_repository as repository;
use crate::services::get_openvpn_servers;
use crate::services::parse_pkcs12_certificate;
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
    pub remote_cert_tls_name: String,
    pub crl_distribution_point: Option<String>,
}

#[derive(Debug, Error)]
pub enum AddOpenvpnServerError {
    #[error("openvpn server name already exists")]
    NameAlreadyExists,
    #[error("openvpn server host and port combination already exists")]
    HostPortAlreadyExists,
    #[error("configuration error: {0}")]
    Config(String),
    #[error("CA service error: {0}")]
    CaService(String),
    #[error("certificate generation error: {0}")]
    CertificateGeneration(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    redis: &RedisConnection,
    config: &Config,
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

    // Step 1: Get default passphrase from config
    let default_passphrase = config
        .get_string("ca_openvpn.default_passphrase")
        .map_err(|e| AddOpenvpnServerError::Config(format!("Failed to get default_passphrase: {}", e)))?;

    // Step 2: Initialize CA OpenVPN service
    let ca_openvpn_service = CaOpenvpnService::new(config)
        .map_err(|e| AddOpenvpnServerError::CaService(format!("Failed to initialize CA service: {}", e)))?;

    // Step 3: Create CSR for server certificate
    log::debug!("add_openvpn_server:create_csr_server name={}", input.name);
    let csr_server_data = ca_openvpn_api_repository::create_csr_server(
        &ca_openvpn_service,
        &default_passphrase,
        &input.name,
    )
    .await
    .map_err(|e| AddOpenvpnServerError::CaService(format!("Failed to create CSR: {}", e)))?;

    log::debug!(
        "add_openvpn_server:csr_created cert_req_id={}",
        csr_server_data.certificate_request_id
    );

    // Step 4: Approve the CSR
    let certificate_data = ca_openvpn_api_repository::approve_csr(
        &ca_openvpn_service,
        &csr_server_data.certificate_request_id,
    )
    .await
    .map_err(|e| AddOpenvpnServerError::CaService(format!("Failed to approve CSR: {}", e)))?;

    log::debug!(
        "add_openvpn_server:csr_approved serial_number={}",
        certificate_data.serial_number
    );

    // Step 5: Parse PKCS#12 certificate
    let server_certificates = parse_pkcs12_certificate::execute(
        &ca_openvpn_service,
        certificate_data.serial_number,
        &default_passphrase,
    )
    .await
    .map_err(|e| AddOpenvpnServerError::CertificateGeneration(format!("Failed to parse PKCS#12: {}", e)))?;

    log::debug!("add_openvpn_server:pkcs12_parsed");

    // Step 6: Get root CA PEM from embedded binary
    let root_ca_pem = root_ca_entity::get_pem();

    // Step 7: Build CA chain PEM (Root CA + Intermediate CA)
    // Note: CA chain contains only CA certificates, not the server certificate
    let ca_chain_pem = format!(
        "{}{}",
        root_ca_pem,
        server_certificates.intermediate_ca_pem
    );

    // Step 8: Server certificate (the server's own certificate)
    let certificate_pem = server_certificates.certificate_pem.clone();

    // Step 9: Parse expired_at from certificate_data
    let expired_at = DateTime::parse_from_rfc3339(&certificate_data.expired_at)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| AddOpenvpnServerError::CertificateGeneration(format!("Failed to parse expired_at: {}", e)))?;

    // Step 10: Create entity with generated certificate data
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
        ca_chain_pem,
        certificate_pem,
        encrypted_private_key_pem: Some(server_certificates.encrypted_private_key_pem),
        serial_number: certificate_data.serial_number,
        expired_at,
        remote_cert_tls_name: input.remote_cert_tls_name,
        crl_distribution_point: input.crl_distribution_point,
        created_at: now,
        updated_at: now,
    };

    repository::create(conn, &entity).await?;

    log::debug!("add_openvpn_server:created id={}", entity.id);

    // Refresh cache by calling get_openvpn_servers with is_cache = false
    let _ = get_openvpn_servers::execute(db, redis, false).await;

    Ok(entity)
}
