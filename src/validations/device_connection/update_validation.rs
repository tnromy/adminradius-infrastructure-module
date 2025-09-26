use serde::Deserialize;
use serde_json::{Value, json};

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct UpdateDeviceConnectionPayload {
    pub from_port_id: String,
    pub to_port_id: String,
    pub details: Option<Value>,
}

#[derive(Debug)]
pub struct UpdateDeviceConnectionValidated {
    pub from_port_id: String,
    pub to_port_id: String,
    pub details: Value,
}

pub fn validate(
    payload: UpdateDeviceConnectionPayload,
) -> Result<UpdateDeviceConnectionValidated, Vec<String>> {
    let mut errors = Vec::new();

    let sanitized_from_port = xss_security_helper::sanitize_input(&payload.from_port_id, 64);
    let safe_from_port = xss_security_helper::strip_dangerous_tags(&sanitized_from_port);
    if safe_from_port.len() != 36 {
        errors.push("from_port_id must be a valid UUID".to_string());
    }

    let sanitized_to_port = xss_security_helper::sanitize_input(&payload.to_port_id, 64);
    let safe_to_port = xss_security_helper::strip_dangerous_tags(&sanitized_to_port);
    if safe_to_port.len() != 36 {
        errors.push("to_port_id must be a valid UUID".to_string());
    }

    if safe_from_port == safe_to_port {
        errors.push("from_port_id and to_port_id must be different".to_string());
    }

    if errors.is_empty() {
        Ok(UpdateDeviceConnectionValidated {
            from_port_id: safe_from_port,
            to_port_id: safe_to_port,
            details: payload.details.unwrap_or_else(|| json!({})),
        })
    } else {
        Err(errors)
    }
}
