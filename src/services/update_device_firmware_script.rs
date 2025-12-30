use thiserror::Error;

use crate::entities::device_firmware_script_entity::DeviceFirmwareScriptEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_script_postgres_repository as repository;

#[derive(Debug)]
pub struct UpdateDeviceFirmwareScriptInput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub script_text: String,
    pub script_params: Vec<String>,
}

#[derive(Debug, Error)]
pub enum UpdateDeviceFirmwareScriptError {
    #[error("device firmware script not found")]
    NotFound,
    #[error("script name already exists in this firmware")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDeviceFirmwareScriptInput,
) -> Result<DeviceFirmwareScriptEntity, UpdateDeviceFirmwareScriptError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Get existing script to get the device_firmware_id
    let existing = repository::get_by_id(conn, &input.id).await?;
    let existing = match existing {
        Some(e) => e,
        None => return Err(UpdateDeviceFirmwareScriptError::NotFound),
    };

    // Check if name already exists in this firmware (excluding current script)
    if repository::name_exists_in_firmware(
        conn,
        &existing.device_firmware_id.to_string(),
        &input.name,
        Some(&input.id),
    )
    .await?
    {
        return Err(UpdateDeviceFirmwareScriptError::NameAlreadyExists);
    }

    let script_params = serde_json::json!(input.script_params);
    repository::update(
        conn,
        &input.id,
        &input.name,
        input.description.as_deref(),
        &input.script_text,
        &script_params,
    )
    .await?;

    let updated = repository::get_by_id(conn, &input.id).await?;
    updated.ok_or(UpdateDeviceFirmwareScriptError::NotFound)
}
