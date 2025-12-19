use crate::utils::xss_security_helper;

#[derive(Debug)]
pub struct UnassignOpenvpnClientValidated {
    pub device_id: String,
    pub openvpn_client_id: String,
}

pub fn validate(
    device_id: String,
    openvpn_client_id: String,
) -> Result<UnassignOpenvpnClientValidated, Vec<String>> {
    let mut errors = Vec::new();

    // Validate device_id
    let sanitized_device_id = xss_security_helper::sanitize_input(&device_id, 36);
    let safe_device_id = xss_security_helper::strip_dangerous_tags(&sanitized_device_id);
    if safe_device_id.is_empty() {
        errors.push("device_id is required".to_string());
    } else if safe_device_id.len() != 36 {
        errors.push("device_id must be a valid UUID".to_string());
    } else if uuid::Uuid::parse_str(&safe_device_id).is_err() {
        errors.push("device_id must be a valid UUID".to_string());
    }

    // Validate openvpn_client_id
    let sanitized_client_id = xss_security_helper::sanitize_input(&openvpn_client_id, 36);
    let safe_client_id = xss_security_helper::strip_dangerous_tags(&sanitized_client_id);
    if safe_client_id.is_empty() {
        errors.push("openvpn_client_id is required".to_string());
    } else if safe_client_id.len() != 36 {
        errors.push("openvpn_client_id must be a valid UUID".to_string());
    } else if uuid::Uuid::parse_str(&safe_client_id).is_err() {
        errors.push("openvpn_client_id must be a valid UUID".to_string());
    }

    if !errors.is_empty() {
        return Err(errors);
    }

    Ok(UnassignOpenvpnClientValidated {
        device_id: safe_device_id,
        openvpn_client_id: safe_client_id,
    })
}
