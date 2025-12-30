use serde::Deserialize;

use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct UpdateDeviceFirmwareScriptPayload {
    pub name: String,
    pub description: Option<String>,
    pub script_text: String,
    pub script_params: Option<Vec<String>>,
}

#[derive(Debug)]
pub struct UpdateDeviceFirmwareScriptValidated {
    pub name: String,
    pub description: Option<String>,
    pub script_text: String,
    pub script_params: Vec<String>,
}

pub fn validate(
    payload: UpdateDeviceFirmwareScriptPayload,
) -> Result<UpdateDeviceFirmwareScriptValidated, Vec<String>> {
    let mut errors = Vec::new();

    let sanitized_name = xss_security_helper::sanitize_input(&payload.name, 255);
    let safe_name = xss_security_helper::strip_dangerous_tags(&sanitized_name);
    if safe_name.is_empty() {
        errors.push("name is required".to_string());
    }

    let safe_description = payload.description.map(|d| {
        let sanitized = xss_security_helper::sanitize_input(&d, 1000);
        xss_security_helper::strip_dangerous_tags(&sanitized)
    }).filter(|d| !d.is_empty());

    // script_text is not sanitized to preserve script content
    let script_text = payload.script_text.clone();
    if script_text.trim().is_empty() {
        errors.push("script_text is required".to_string());
    }

    // script_params: sanitize each param key
    let script_params = payload.script_params.unwrap_or_default()
        .into_iter()
        .map(|p| {
            let sanitized = xss_security_helper::sanitize_input(&p, 100);
            xss_security_helper::strip_dangerous_tags(&sanitized)
        })
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>();

    if errors.is_empty() {
        Ok(UpdateDeviceFirmwareScriptValidated {
            name: safe_name,
            description: safe_description,
            script_text,
            script_params,
        })
    } else {
        Err(errors)
    }
}
