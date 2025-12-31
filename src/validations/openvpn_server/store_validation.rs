use serde::Deserialize;

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct StoreOpenvpnServerPayload {
    pub name: String,
    pub host: String,
    pub port: Option<i32>,
    pub proto: Option<String>,
    pub subnet: Option<String>,
    pub cipher: Option<String>,
    pub auth_algorithm: Option<String>,
    pub tls_key_pem: Option<String>,
    pub tls_key_mode: Option<String>,
    pub remote_cert_tls_name: Option<String>,
    pub crl_distribution_point: Option<String>,
}

#[derive(Debug)]
pub struct StoreOpenvpnServerValidated {
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proto: String,
    pub subnet: String,
    pub cipher: Option<String>,
    pub auth_algorithm: String,
    pub tls_key_pem: Option<String>,
    pub tls_key_mode: Option<String>,
    pub remote_cert_tls_name: String,
    pub crl_distribution_point: Option<String>,
}

pub fn validate(payload: StoreOpenvpnServerPayload) -> Result<StoreOpenvpnServerValidated, Vec<String>> {
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

    // Validate port (default 1194 if not provided)
    let port = payload.port.unwrap_or(1194);
    if !(1..=65535).contains(&port) {
        errors.push("port must be between 1 and 65535".to_string());
    }

    // Validate proto (default "udp" if not provided)
    let proto = if let Some(p) = payload.proto {
        let sanitized_proto = xss_security_helper::sanitize_input(&p, 10);
        let safe_proto = xss_security_helper::strip_dangerous_tags(&sanitized_proto);
        if safe_proto.is_empty() {
            "udp".to_string()
        } else {
            safe_proto
        }
    } else {
        "udp".to_string()
    };

    // Validate subnet (default "10.8.0.0/24" if not provided)
    let subnet = if let Some(s) = payload.subnet {
        let sanitized_subnet = xss_security_helper::sanitize_input(&s, 18);
        let safe_subnet = xss_security_helper::strip_dangerous_tags(&sanitized_subnet);
        if safe_subnet.is_empty() {
            "10.8.0.0/24".to_string()
        } else {
            safe_subnet
        }
    } else {
        "10.8.0.0/24".to_string()
    };

    // Validate cipher (optional, but sanitize if provided)
    let cipher = payload.cipher.map(|c| {
        let sanitized = xss_security_helper::sanitize_input(&c, 50);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    }).filter(|s| !s.is_empty());

    // Validate auth_algorithm (default "SHA256" if not provided)
    let auth_algorithm = if let Some(a) = payload.auth_algorithm {
        let sanitized_auth = xss_security_helper::sanitize_input(&a, 50);
        let safe_auth = xss_security_helper::strip_dangerous_tags(&sanitized_auth);
        if safe_auth.is_empty() {
            "SHA256".to_string()
        } else {
            safe_auth
        }
    } else {
        "SHA256".to_string()
    };

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

    // Validate remote_cert_tls_name (default "server" if not provided)
    let remote_cert_tls_name = if let Some(r) = payload.remote_cert_tls_name {
        let sanitized_remote = xss_security_helper::sanitize_input(&r, 100);
        let safe_remote = xss_security_helper::strip_dangerous_tags(&sanitized_remote);
        if safe_remote.is_empty() {
            "server".to_string()
        } else {
            safe_remote
        }
    } else {
        "server".to_string()
    };

    // Validate crl_distribution_point (optional)
    let crl_distribution_point = payload.crl_distribution_point.map(|c| {
        let sanitized = xss_security_helper::sanitize_input(&c, 1000);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    }).filter(|s| !s.is_empty());

    if errors.is_empty() {
        Ok(StoreOpenvpnServerValidated {
            name: safe_name,
            host: safe_host,
            port,
            proto,
            subnet,
            cipher,
            auth_algorithm,
            tls_key_pem,
            tls_key_mode,
            remote_cert_tls_name,
            crl_distribution_point,
        })
    } else {
        Err(errors)
    }
}
