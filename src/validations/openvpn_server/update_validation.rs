use serde::Deserialize;

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct UpdateOpenvpnServerPayload {
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

#[derive(Debug)]
pub struct UpdateOpenvpnServerValidated {
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

pub fn validate(payload: UpdateOpenvpnServerPayload) -> Result<UpdateOpenvpnServerValidated, Vec<String>> {
    let mut errors = Vec::new();

    // Validate name
    let sanitized_name = xss_security_helper::sanitize_input(&payload.name, 255);
    let safe_name = xss_security_helper::strip_dangerous_tags(&sanitized_name);
    if safe_name.is_empty() {
        errors.push("name is required".to_string());
    }

    // Validate host
    let sanitized_host = xss_security_helper::sanitize_input(&payload.host, 45);
    let safe_host = xss_security_helper::strip_dangerous_tags(&sanitized_host);
    if safe_host.is_empty() {
        errors.push("host is required".to_string());
    }

    // Validate port
    if !(1..=65535).contains(&payload.port) {
        errors.push("port must be between 1 and 65535".to_string());
    }

    // Validate proto
    let sanitized_proto = xss_security_helper::sanitize_input(&payload.proto, 10);
    let safe_proto = xss_security_helper::strip_dangerous_tags(&sanitized_proto);
    if safe_proto.is_empty() {
        errors.push("proto is required".to_string());
    }

    // Validate cipher (optional, but sanitize if provided)
    let cipher = payload.cipher.map(|c| {
        let sanitized = xss_security_helper::sanitize_input(&c, 50);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    }).filter(|s| !s.is_empty());

    // Validate auth_algorithm
    let sanitized_auth = xss_security_helper::sanitize_input(&payload.auth_algorithm, 50);
    let safe_auth = xss_security_helper::strip_dangerous_tags(&sanitized_auth);
    if safe_auth.is_empty() {
        errors.push("auth_algorithm is required".to_string());
    }

    // Validate tls_key_pem (optional)
    let tls_key_pem = payload.tls_key_pem.map(|t| {
        let sanitized = xss_security_helper::sanitize_input(&t, 10000);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    }).filter(|s| !s.is_empty());

    // Validate tls_key_mode (optional)
    let tls_key_mode = payload.tls_key_mode.map(|t| {
        let sanitized = xss_security_helper::sanitize_input(&t, 10);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    }).filter(|s| !s.is_empty());

    // Validate ca_chain_pem (required)
    let sanitized_ca = xss_security_helper::sanitize_input(&payload.ca_chain_pem, 100000);
    let safe_ca = xss_security_helper::strip_dangerous_tags(&sanitized_ca);
    if safe_ca.is_empty() {
        errors.push("ca_chain_pem is required".to_string());
    }

    // Validate dh_pem (required)
    let sanitized_dh = xss_security_helper::sanitize_input(&payload.dh_pem, 10000);
    let safe_dh = xss_security_helper::strip_dangerous_tags(&sanitized_dh);
    if safe_dh.is_empty() {
        errors.push("dh_pem is required".to_string());
    }

    // Validate remote_cert_tls_name
    let sanitized_remote = xss_security_helper::sanitize_input(&payload.remote_cert_tls_name, 100);
    let safe_remote = xss_security_helper::strip_dangerous_tags(&sanitized_remote);
    if safe_remote.is_empty() {
        errors.push("remote_cert_tls_name is required".to_string());
    }

    // Validate crl_distribution_point (optional)
    let crl_distribution_point = payload.crl_distribution_point.map(|c| {
        let sanitized = xss_security_helper::sanitize_input(&c, 1000);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    }).filter(|s| !s.is_empty());

    if errors.is_empty() {
        Ok(UpdateOpenvpnServerValidated {
            name: safe_name,
            host: safe_host,
            port: payload.port,
            proto: safe_proto,
            cipher,
            auth_algorithm: safe_auth,
            tls_key_pem,
            tls_key_mode,
            ca_chain_pem: safe_ca,
            dh_pem: safe_dh,
            remote_cert_tls_name: safe_remote,
            crl_distribution_point,
        })
    } else {
        Err(errors)
    }
}
