use std::collections::HashSet;
use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_script_postgres_repository as repository;
use crate::utils::script_builder;

#[derive(Debug)]
pub struct BuildDeviceFirmwareScriptInput {
    pub id: String,
    pub script_params_data: serde_json::Value,
    pub filename: String,
}

#[derive(Debug)]
pub struct BuildDeviceFirmwareScriptOutput {
    pub rendered_script: String,
    pub filename: String,
}

#[derive(Debug, Error)]
pub enum BuildDeviceFirmwareScriptError {
    #[error("device firmware script not found")]
    NotFound,
    #[error("invalid script_params_data: expected JSON object")]
    InvalidParamsData,
    #[error("missing required parameter: {0}")]
    MissingParameter(String),
    #[error("script rendering failed: {0}")]
    RenderError(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: BuildDeviceFirmwareScriptInput,
) -> Result<BuildDeviceFirmwareScriptOutput, BuildDeviceFirmwareScriptError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // 1. Fetch script from database
    let script = repository::get_by_id(conn, &input.id)
        .await?
        .ok_or(BuildDeviceFirmwareScriptError::NotFound)?;

    // 2. Validate script_params_data is a JSON object
    let params_data = match input.script_params_data.as_object() {
        Some(obj) => obj,
        None => return Err(BuildDeviceFirmwareScriptError::InvalidParamsData),
    };

    // 3. Extract required keys from script_params (array of strings from database)
    let required_keys: HashSet<String> = match &script.script_params {
        serde_json::Value::Array(arr) => {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        }
        _ => HashSet::new(),
    };

    // 4. Validate all required keys exist in script_params_data
    let provided_keys: HashSet<String> = params_data.keys().cloned().collect();
    for required_key in &required_keys {
        if !provided_keys.contains(required_key) {
            return Err(BuildDeviceFirmwareScriptError::MissingParameter(
                required_key.clone(),
            ));
        }
    }

    // 5. Render the script using handlebars helper
    let rendered_script = script_builder::render_script(&script.script_text, &input.script_params_data)
        .map_err(|e| BuildDeviceFirmwareScriptError::RenderError(e.to_string()))?;

    Ok(BuildDeviceFirmwareScriptOutput {
        rendered_script,
        filename: input.filename,
    })
}
