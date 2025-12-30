use thiserror::Error;

use crate::entities::device_firmware_script_entity::DeviceFirmwareScriptEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_postgres_repository as firmware_repository;
use crate::repositories::postgresql::device_firmware_script_postgres_repository as repository;

#[derive(Debug, Error)]
pub enum GetAllDeviceFirmwareScriptsError {
    #[error("device firmware not found")]
    FirmwareNotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    device_firmware_id: &str,
) -> Result<Vec<DeviceFirmwareScriptEntity>, GetAllDeviceFirmwareScriptsError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Check if firmware exists
    if !firmware_repository::exists(conn, device_firmware_id).await? {
        return Err(GetAllDeviceFirmwareScriptsError::FirmwareNotFound);
    }

    let scripts = repository::get_all_by_firmware(conn, device_firmware_id).await?;
    Ok(scripts)
}
