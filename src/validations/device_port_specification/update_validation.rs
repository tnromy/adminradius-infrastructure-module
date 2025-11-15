use serde::Deserialize;
use serde_json::{Map, Value};

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct UpdateDevicePortSpecificationPayload {
    pub name: String,
    #[serde(default)]
    pub data: Value,
}

#[derive(Debug)]
pub struct UpdateDevicePortSpecificationValidated {
    pub name: String,
    pub data: Value,
}

pub fn validate(
    payload: UpdateDevicePortSpecificationPayload,
) -> Result<UpdateDevicePortSpecificationValidated, Vec<String>> {
    let mut errors = Vec::new();

    let sanitized_name = xss_security_helper::sanitize_input(&payload.name, 255);
    let safe_name = xss_security_helper::strip_dangerous_tags(&sanitized_name);
    if safe_name.is_empty() {
        errors.push("name is required".to_string());
    }

    let data = match payload.data {
        Value::Null => Value::Object(Map::new()),
        Value::Object(map) => Value::Object(map),
        other => other,
    };

    if errors.is_empty() {
        Ok(UpdateDevicePortSpecificationValidated {
            name: safe_name,
            data,
        })
    } else {
        Err(errors)
    }
}
