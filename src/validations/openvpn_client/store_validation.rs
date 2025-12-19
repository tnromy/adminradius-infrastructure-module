use serde::Deserialize;

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct StoreOpenvpnClientPayload {
    pub name: Option<String>,
}

#[derive(Debug)]
pub struct StoreOpenvpnClientValidated {
    pub openvpn_server_id: String,
    pub name: Option<String>,
}

pub fn validate(
    openvpn_server_id: String,
    payload: StoreOpenvpnClientPayload,
) -> Result<StoreOpenvpnClientValidated, Vec<String>> {
    let mut errors = Vec::new();

    // Validate openvpn_server_id
    let sanitized_server_id = xss_security_helper::sanitize_input(&openvpn_server_id, 36);
    let safe_server_id = xss_security_helper::strip_dangerous_tags(&sanitized_server_id);
    if safe_server_id.is_empty() {
        errors.push("openvpn_server_id is required".to_string());
    }

    // Validate UUID format
    if uuid::Uuid::parse_str(&safe_server_id).is_err() {
        errors.push("openvpn_server_id must be a valid UUID".to_string());
    }

    // Validate name (optional, max 255 chars)
    let safe_name = payload.name.as_ref().map(|n| {
        let sanitized = xss_security_helper::sanitize_input(n, 255);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    });

    if !errors.is_empty() {
        return Err(errors);
    }

    Ok(StoreOpenvpnClientValidated {
        openvpn_server_id: safe_server_id,
        name: safe_name.filter(|n| !n.is_empty()),
    })
}
