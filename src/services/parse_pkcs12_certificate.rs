use anyhow::{Context, Result};

use crate::entities::parsed_pkcs12_entity::ParsedPkcs12Entity;
use crate::infrastructures::ca_openvpn::CaOpenvpnService;
use crate::repositories::api::ca_openvpn_api_repository;
use crate::utils::pkcs12_helper;

/// Fetch and parse a PKCS#12 certificate from the OpenVPN CA service.
///
/// This service:
/// 1. Fetches the PKCS#12 bundle from the CA API using the serial number
/// 2. Extracts the certificate, private key, and intermediate CA
/// 3. Re-encrypts the private key with the provided passphrase
///
/// # Arguments
/// * `ca_openvpn_service` - The OpenVPN CA service instance
/// * `serial_number` - The serial number of the certificate to fetch
/// * `passphrase` - The passphrase for PKCS#12 decryption and private key re-encryption
///
/// # Returns
/// * `ParsedPkcs12Entity` containing:
///   - `intermediate_ca_pem`: The intermediate CA certificate in PEM format
///   - `certificate_pem`: The client/server certificate in PEM format
///   - `encrypted_private_key_pem`: The private key encrypted with the passphrase in PEM format
///
/// # Errors
/// Returns an error if:
/// - Failed to fetch PKCS#12 from the CA API
/// - Failed to parse or extract PKCS#12 contents
pub async fn execute(
    ca_openvpn_service: &CaOpenvpnService,
    serial_number: i64,
    passphrase: &str,
) -> Result<ParsedPkcs12Entity> {
    log::debug!(
        "parse_pkcs12_certificate:execute:start serial_number={}",
        serial_number
    );

    // Fetch PKCS#12 DER from the CA API
    let pkcs12_der = ca_openvpn_api_repository::get_pkcs12(
        ca_openvpn_service,
        serial_number,
        passphrase,
    )
    .await
    .context("Failed to fetch PKCS#12 from CA API")?;

    log::debug!(
        "parse_pkcs12_certificate:execute:fetched serial_number={} size={}",
        serial_number,
        pkcs12_der.len()
    );

    // Extract and parse PKCS#12 contents
    // Note: Both pkcs12_password and passphrase use the same value
    let parsed = pkcs12_helper::extract_pkcs12(&pkcs12_der, passphrase, passphrase)
        .map_err(|e| anyhow::anyhow!("Failed to extract PKCS#12: {}", e))?;

    log::debug!(
        "parse_pkcs12_certificate:execute:success serial_number={}",
        serial_number
    );

    Ok(parsed)
}
