use chrono::Utc;
use thiserror::Error;

use crate::entities::device_firmware_script_entity::DeviceFirmwareScriptEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_postgres_repository as firmware_repository;
use crate::repositories::postgresql::device_firmware_script_postgres_repository as repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDeviceFirmwareScriptInput {
    pub device_firmware_id: String,
    pub name: String,
    pub description: Option<String>,
    pub script_text: String,
    pub script_params: Vec<String>,
}

#[derive(Debug, Error)]
pub enum AddDeviceFirmwareScriptError {
    #[error("device firmware not found")]
    FirmwareNotFound,
    #[error("script name already exists in this firmware")]
    NameAlreadyExists,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDeviceFirmwareScriptInput,
) -> Result<DeviceFirmwareScriptEntity, AddDeviceFirmwareScriptError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Check if firmware exists
    if !firmware_repository::exists(conn, &input.device_firmware_id).await? {
        return Err(AddDeviceFirmwareScriptError::FirmwareNotFound);
    }

    // Check if name already exists in this firmware
    if repository::name_exists_in_firmware(conn, &input.device_firmware_id, &input.name, None).await? {
        return Err(AddDeviceFirmwareScriptError::NameAlreadyExists);
    }

    let now = Utc::now();
    
    let entity = DeviceFirmwareScriptEntity {
        id: uuid_helper::generate(),
        device_firmware_id: input.device_firmware_id,
        name: input.name,
        description: input.description,
        script_text: input.script_text,
        script_params: serde_json::json!(input.script_params),
        created_at: Some(now),
        updated_at: Some(now),
    };

    repository::create(conn, &entity).await?;

    Ok(entity)
}

