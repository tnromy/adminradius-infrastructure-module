use crate::entities::device_firmware_script_entity::DeviceFirmwareScriptEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_firmware_script_postgres_repository as repository;

pub async fn execute(
    db: &DatabaseConnection,
    id: &str,
) -> Result<Option<DeviceFirmwareScriptEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::get_by_id(pool.as_ref(), id).await
}
