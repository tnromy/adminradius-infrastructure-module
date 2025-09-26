use serde::Deserialize;
use serde_json::{Value, json};

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct UpdateDevicePayload {
    pub name: String,
    pub device_type_id: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location_details: Option<Value>,
    pub specifications: Option<Value>,
}

#[derive(Debug)]
pub struct UpdateDeviceValidated {
    pub name: String,
    pub device_type_id: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location_details: Value,
    pub specifications: Value,
}

pub fn validate(payload: UpdateDevicePayload) -> Result<UpdateDeviceValidated, Vec<String>> {
    let mut errors = Vec::new();

    let sanitized_name = xss_security_helper::sanitize_input(&payload.name, 255);
    let safe_name = xss_security_helper::strip_dangerous_tags(&sanitized_name);
    if safe_name.is_empty() {
        errors.push("name is required".to_string());
    }

    let sanitized_device_type_id = xss_security_helper::sanitize_input(&payload.device_type_id, 64);
    let safe_device_type_id = xss_security_helper::strip_dangerous_tags(&sanitized_device_type_id);
    if safe_device_type_id.len() != 36 {
        errors.push("device_type_id must be a valid UUID".to_string());
    }

    if let Some(lat) = payload.latitude {
        if !(lat >= -90.0 && lat <= 90.0) {
            errors.push("latitude must be between -90 and 90".to_string());
        }
    }

    if let Some(lon) = payload.longitude {
        if !(lon >= -180.0 && lon <= 180.0) {
            errors.push("longitude must be between -180 and 180".to_string());
        }
    }

    if errors.is_empty() {
        Ok(UpdateDeviceValidated {
            name: safe_name,
            device_type_id: safe_device_type_id,
            latitude: payload.latitude,
            longitude: payload.longitude,
            location_details: payload.location_details.unwrap_or_else(|| json!({})),
            specifications: payload.specifications.unwrap_or_else(|| json!({})),
        })
    } else {
        Err(errors)
    }
}
