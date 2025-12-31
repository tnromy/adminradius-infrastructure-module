use anyhow::Result;
use serde::Serialize;
use tokio::time::Instant;

use crate::entities::ca_openvpn_approved_certificate_entity::CaOpenvpnApprovedCertificateEntity;
use crate::entities::ca_openvpn_csr_client_entity::CaOpenvpnCsrClientEntity;
use crate::entities::ca_openvpn_csr_server_entity::CaOpenvpnCsrServerEntity;
use crate::infrastructures::ca_openvpn::CaOpenvpnService;

/// Internal struct for CSR request body subject field
#[derive(Serialize)]
struct CsrSubject {
    #[serde(rename = "CN")]
    cn: Option<String>,
}

/// Internal struct for CSR request body
#[derive(Serialize)]
struct CsrRequestBody {
    certificate_type: String,
    subject: CsrSubject,
    passphrase: String,
}

/// Internal struct for PKCS#12 request body
#[derive(Serialize)]
struct Pkcs12RequestBody {
    passphrase: String,
    pkcs12_password: String,
}

/// Create a certificate signing request (CSR) for a client certificate.
///
/// # Arguments
/// * `ca_openvpn_service` - The OpenVPN CA service instance
/// * `passphrase` - Required passphrase for the certificate
/// * `cn` - Optional Common Name (CN) for the certificate subject
///
/// # Returns
/// * `CaOpenvpnCsrClientEntity` containing certificate_request_id, message, requested_at, and reserved_ip_address
pub async fn create_csr_client(
    ca_openvpn_service: &CaOpenvpnService,
    passphrase: &str,
    cn: Option<&str>,
) -> Result<CaOpenvpnCsrClientEntity> {
    log::debug!("ca_openvpn_api:create_csr_client:prepare");
    let start = Instant::now();

    let body = CsrRequestBody {
        certificate_type: "client".to_string(),
        subject: CsrSubject {
            cn: cn.map(|s| s.to_string()),
        },
        passphrase: passphrase.to_string(),
    };

    match ca_openvpn_service
        .post::<CaOpenvpnCsrClientEntity, CsrRequestBody>("/certificate/req", &body)
        .await
    {
        Ok(result) => {
            log::debug!(
                "ca_openvpn_api:create_csr_client:ok cert_req_id={} elapsed_ms={}",
                result.certificate_request_id,
                start.elapsed().as_millis()
            );
            Ok(result)
        }
        Err(e) => {
            log::error!(
                "ca_openvpn_api:create_csr_client:err err={} elapsed_ms={}",
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Create a certificate signing request (CSR) for a server certificate.
///
/// # Arguments
/// * `ca_openvpn_service` - The OpenVPN CA service instance
/// * `passphrase` - Required passphrase for the certificate
/// * `cn` - Required Common Name (CN) for the certificate subject
///
/// # Returns
/// * `CaOpenvpnCsrServerEntity` containing certificate_request_id, message, and requested_at
pub async fn create_csr_server(
    ca_openvpn_service: &CaOpenvpnService,
    passphrase: &str,
    cn: &str,
) -> Result<CaOpenvpnCsrServerEntity> {
    log::debug!("ca_openvpn_api:create_csr_server:prepare cn={}", cn);
    let start = Instant::now();

    let body = CsrRequestBody {
        certificate_type: "server".to_string(),
        subject: CsrSubject {
            cn: Some(cn.to_string()),
        },
        passphrase: passphrase.to_string(),
    };

    match ca_openvpn_service
        .post::<CaOpenvpnCsrServerEntity, CsrRequestBody>("/certificate/req", &body)
        .await
    {
        Ok(result) => {
            log::debug!(
                "ca_openvpn_api:create_csr_server:ok cert_req_id={} elapsed_ms={}",
                result.certificate_request_id,
                start.elapsed().as_millis()
            );
            Ok(result)
        }
        Err(e) => {
            log::error!(
                "ca_openvpn_api:create_csr_server:err err={} elapsed_ms={}",
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Approve a certificate signing request (CSR).
///
/// # Arguments
/// * `ca_openvpn_service` - The OpenVPN CA service instance
/// * `certificate_request_id` - The ID of the certificate request to approve
///
/// # Returns
/// * `CaOpenvpnApprovedCertificateEntity` containing certificate_pem, cn, expired_at, issued_at, message, and serial_number
pub async fn approve_csr(
    ca_openvpn_service: &CaOpenvpnService,
    certificate_request_id: &str,
) -> Result<CaOpenvpnApprovedCertificateEntity> {
    log::debug!(
        "ca_openvpn_api:approve_csr:prepare cert_req_id={}",
        certificate_request_id
    );
    let start = Instant::now();

    let endpoint = format!("/certificate/req/{}/approve", certificate_request_id);

    match ca_openvpn_service
        .put_no_body::<CaOpenvpnApprovedCertificateEntity>(&endpoint)
        .await
    {
        Ok(result) => {
            log::debug!(
                "ca_openvpn_api:approve_csr:ok cert_req_id={} serial_number={} elapsed_ms={}",
                certificate_request_id,
                result.serial_number,
                start.elapsed().as_millis()
            );
            Ok(result)
        }
        Err(e) => {
            log::error!(
                "ca_openvpn_api:approve_csr:err cert_req_id={} err={} elapsed_ms={}",
                certificate_request_id,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get PKCS#12 certificate bundle by serial number.
///
/// # Arguments
/// * `ca_openvpn_service` - The OpenVPN CA service instance
/// * `serial_number` - The serial number of the certificate
/// * `passphrase` - The passphrase used for PKCS#12 encryption
///
/// # Returns
/// * `Vec<u8>` containing the PKCS#12 DER binary data
pub async fn get_pkcs12(
    ca_openvpn_service: &CaOpenvpnService,
    serial_number: i64,
    passphrase: &str,
) -> Result<Vec<u8>> {
    log::debug!(
        "ca_openvpn_api:get_pkcs12:prepare serial_number={}",
        serial_number
    );
    let start = Instant::now();

    let endpoint = format!("/certificate/{}/pkcs12", serial_number);

    let body = Pkcs12RequestBody {
        passphrase: passphrase.to_string(),
        pkcs12_password: passphrase.to_string(),
    };

    match ca_openvpn_service.get_binary(&endpoint, &body).await {
        Ok(result) => {
            log::debug!(
                "ca_openvpn_api:get_pkcs12:ok serial_number={} size={} elapsed_ms={}",
                serial_number,
                result.len(),
                start.elapsed().as_millis()
            );
            Ok(result)
        }
        Err(e) => {
            log::error!(
                "ca_openvpn_api:get_pkcs12:err serial_number={} err={} elapsed_ms={}",
                serial_number,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}
