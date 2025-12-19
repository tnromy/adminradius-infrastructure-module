use crate::utils::xss_security_helper;

#[derive(Debug)]
pub struct ActivateRadiusClientValidated {
    pub device_id: String,
    pub device_vendor_id: i32,
}

pub fn validate(
    device_id: String,
    device_vendor_id: i32,
) -> Result<ActivateRadiusClientValidated, Vec<String>> {
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

    // Validate device_vendor_id
    if device_vendor_id <= 0 {
        errors.push("device_vendor_id must be a positive integer".to_string());
    }

    if !errors.is_empty() {
        return Err(errors);
    }

    Ok(ActivateRadiusClientValidated {
        device_id: safe_device_id,
        device_vendor_id,
    })
}
