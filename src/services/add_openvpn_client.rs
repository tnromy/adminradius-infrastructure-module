use chrono::{DateTime, Utc};
use config::Config;
use thiserror::Error;

use crate::entities::openvpn_client_entity::OpenvpnClientEntity;
use crate::entities::private_key_passphrase_entity::PrivateKeyPassphraseEntity;
use crate::infrastructures::ca_openvpn::CaOpenvpnService;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::repositories::api::ca_openvpn_api_repository;
use crate::repositories::postgresql::openvpn_client_postgres_repository as repository;
use crate::repositories::postgresql::openvpn_server_postgres_repository as server_repository;
use crate::repositories::postgresql::private_key_passphrase_postgres_repository as passphrase_repository;
use crate::services::get_openvpn_clients;
use crate::services::parse_pkcs12_certificate;
use crate::utils::crypt_helper;
use crate::utils::hash_helper;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddOpenvpnClientInput {
    pub openvpn_server_id: String,
    pub name: Option<String>,
}

#[derive(Debug, Error)]
pub enum AddOpenvpnClientError {
    #[error("openvpn server not found")]
    ServerNotFound,
    #[error("configuration error: {0}")]
    Config(String),
    #[error("CA service error: {0}")]
    CaService(String),
    #[error("certificate generation error: {0}")]
    CertificateGeneration(String),
    #[error("passphrase encryption error: {0}")]
    PassphraseEncryption(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    redis: &RedisConnection,
    config: &Config,
    input: AddOpenvpnClientInput,
) -> Result<OpenvpnClientEntity, AddOpenvpnClientError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Step 1: Verify server exists
    let server = server_repository::get_by_id(conn, &input.openvpn_server_id)
        .await?
        .ok_or(AddOpenvpnClientError::ServerNotFound)?;

    // Step 2: Generate unique passphrase for this private key
    let unique_passphrase = uuid_helper::generate();

    // Step 3: Get master key from config (used to encrypt the unique passphrase)
    let master_key = config
        .get_string("ca_openvpn.default_passphrase")
        .map_err(|e| AddOpenvpnClientError::Config(format!("Failed to get default_passphrase: {}", e)))?;

    // Step 4: Initialize CA OpenVPN service
    let ca_openvpn_service = CaOpenvpnService::new(config)
        .map_err(|e| AddOpenvpnClientError::CaService(format!("Failed to initialize CA service: {}", e)))?;

    // Step 5: Create CSR for client certificate using unique passphrase
    let cn = input.name.as_deref();
    log::debug!(
        "add_openvpn_client:create_csr_client server_id={} cn={:?}",
        server.id,
        cn
    );

    let csr_client_data = ca_openvpn_api_repository::create_csr_client(
        &ca_openvpn_service,
        &unique_passphrase,
        cn,
    )
    .await
    .map_err(|e| AddOpenvpnClientError::CaService(format!("Failed to create CSR: {}", e)))?;

    log::debug!(
        "add_openvpn_client:csr_created cert_req_id={} reserved_ip={}",
        csr_client_data.certificate_request_id,
        &csr_client_data.reserved_ip_address
    );

    // Step 6: Approve the CSR
    let certificate_data = ca_openvpn_api_repository::approve_csr(
        &ca_openvpn_service,
        &csr_client_data.certificate_request_id,
    )
    .await
    .map_err(|e| AddOpenvpnClientError::CaService(format!("Failed to approve CSR: {}", e)))?;

    log::debug!(
        "add_openvpn_client:csr_approved serial_number={}",
        certificate_data.serial_number
    );

    // Step 7: Parse PKCS#12 certificate using unique passphrase
    let client_certificates = parse_pkcs12_certificate::execute(
        &ca_openvpn_service,
        certificate_data.serial_number,
        &unique_passphrase,
    )
    .await
    .map_err(|e| AddOpenvpnClientError::CertificateGeneration(format!("Failed to parse PKCS#12: {}", e)))?;

    log::debug!("add_openvpn_client:pkcs12_parsed");

    // Step 8: Store encrypted passphrase linked to private key hash
    let private_key_hash = hash_helper::sha256(&client_certificates.encrypted_private_key_pem)
        .map_err(|e| AddOpenvpnClientError::PassphraseEncryption(format!("Failed to hash private key: {}", e)))?;
    
    let encrypted_passphrase = crypt_helper::encrypt_string(&unique_passphrase, &master_key)
        .map_err(|e| AddOpenvpnClientError::PassphraseEncryption(format!("Failed to encrypt passphrase: {}", e)))?;

    let passphrase_entity = PrivateKeyPassphraseEntity {
        id: uuid_helper::generate(),
        private_key_hash,
        encrypted_passphrase,
    };

    passphrase_repository::create(conn, &passphrase_entity).await?;

    log::debug!("add_openvpn_client:passphrase_stored id={}", passphrase_entity.id);

    // Step 9: Parse expired_at from certificate_data
    let expired_at = DateTime::parse_from_rfc3339(&certificate_data.expired_at)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| AddOpenvpnClientError::CertificateGeneration(format!("Failed to parse expired_at: {}", e)))?;

    // Step 10: Use CN from certificate approval response
    let final_cn = certificate_data.cn.clone();

    log::debug!("add_openvpn_client:cn_determined cn={}", final_cn);

    // Step 11: Create entity
    let now = Utc::now();
    
    // Convert reserved_ip_address to Option - empty string becomes None
    let reserved_ip = if csr_client_data.reserved_ip_address.is_empty() {
        None
    } else {
        Some(csr_client_data.reserved_ip_address)
    };
    
    let entity = OpenvpnClientEntity {
        id: uuid_helper::generate(),
        server_id: input.openvpn_server_id.clone(),
        cn: final_cn,
        reserved_ip_address: reserved_ip,
        certificate_pem: client_certificates.certificate_pem,
        encrypted_private_key_pem: client_certificates.encrypted_private_key_pem,
        revoked_at: None,
        expired_at,
        created_at: now,
        updated_at: now,
    };

    // Step 12: Save to database
    repository::create(conn, &entity).await?;

    log::debug!("add_openvpn_client:created id={}", entity.id);

    // Step 13: Invalidate cache
    get_openvpn_clients::invalidate_cache(redis, &input.openvpn_server_id).await;

    Ok(entity)
}
