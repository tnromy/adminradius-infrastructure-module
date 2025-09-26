use serde::Deserialize;
use serde_json::{Value, json};

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct StoreDevicePortPayload {
    pub name: String,
    pub port_type_id: String,
    pub port_specification_id: Option<String>,
    pub position: Option<i32>,
    pub enabled: Option<bool>,
    pub properties: Option<Value>,
}

#[derive(Debug)]
pub struct StoreDevicePortValidated {
    pub name: String,
    pub port_type_id: String,
    pub port_specification_id: Option<String>,
    pub position: Option<i32>,
    pub enabled: bool,
    pub properties: Value,
}

pub fn validate(payload: StoreDevicePortPayload) -> Result<StoreDevicePortValidated, Vec<String>> {
    let mut errors = Vec::new();

    let sanitized_name = xss_security_helper::sanitize_input(&payload.name, 255);
    let safe_name = xss_security_helper::strip_dangerous_tags(&sanitized_name);
    if safe_name.is_empty() {
        errors.push("name is required".to_string());
    }

    let sanitized_port_type_id = xss_security_helper::sanitize_input(&payload.port_type_id, 64);
    let safe_port_type_id = xss_security_helper::strip_dangerous_tags(&sanitized_port_type_id);
    if safe_port_type_id.len() != 36 {
        errors.push("port_type_id must be a valid UUID".to_string());
    }

    let safe_port_specification_id = if let Some(ref spec_id) = payload.port_specification_id {
        let sanitized = xss_security_helper::sanitize_input(spec_id, 64);
        let safe = xss_security_helper::strip_dangerous_tags(&sanitized);
        if safe.len() != 36 {
            errors.push("port_specification_id must be a valid UUID".to_string());
        }
        Some(safe)
    } else {
        None
    };

    if let Some(position) = payload.position {
        if position < 0 {
            errors.push("position must be zero or positive".to_string());
        }
    }

    if errors.is_empty() {
        Ok(StoreDevicePortValidated {
            name: safe_name,
            port_type_id: safe_port_type_id,
            port_specification_id: safe_port_specification_id,
            position: payload.position,
            enabled: payload.enabled.unwrap_or(true),
            properties: payload.properties.unwrap_or_else(|| json!({})),
        })
    } else {
        Err(errors)
    }
}
