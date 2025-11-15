use serde::Deserialize;

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct StoreDevicePortInterfacePayload {
    pub name: String,
}

#[derive(Debug)]
pub struct StoreDevicePortInterfaceValidated {
    pub name: String,
}

pub fn validate(
    payload: StoreDevicePortInterfacePayload,
) -> Result<StoreDevicePortInterfaceValidated, Vec<String>> {
    let mut errors = Vec::new();

    let sanitized_name = xss_security_helper::sanitize_input(&payload.name, 255);
    let safe_name = xss_security_helper::strip_dangerous_tags(&sanitized_name);
    if safe_name.is_empty() {
        errors.push("name is required".to_string());
    }

    if errors.is_empty() {
        Ok(StoreDevicePortInterfaceValidated { name: safe_name })
    } else {
        Err(errors)
    }
}
