use serde::Deserialize;

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct StoreDeviceFirmwarePayload {
    pub name: String,
    pub version: String,
}

#[derive(Debug)]
pub struct StoreDeviceFirmwareValidated {
    pub name: String,
    pub version: String,
}

pub fn validate(payload: StoreDeviceFirmwarePayload) -> Result<StoreDeviceFirmwareValidated, Vec<String>> {
    let mut errors = Vec::new();

    let sanitized_name = xss_security_helper::sanitize_input(&payload.name, 255);
    let safe_name = xss_security_helper::strip_dangerous_tags(&sanitized_name);
    if safe_name.is_empty() {
        errors.push("name is required".to_string());
    }

    let sanitized_version = xss_security_helper::sanitize_input(&payload.version, 100);
    let safe_version = xss_security_helper::strip_dangerous_tags(&sanitized_version);
    if safe_version.is_empty() {
        errors.push("version is required".to_string());
    }

    if errors.is_empty() {
        Ok(StoreDeviceFirmwareValidated {
            name: safe_name,
            version: safe_version,
        })
    } else {
        Err(errors)
    }
}
