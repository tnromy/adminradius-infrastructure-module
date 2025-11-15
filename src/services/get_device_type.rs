use crate::entities::device_type_entity::DeviceTypeEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_type_postgres_repository as repository;

pub async fn execute(
    db: &DatabaseConnection,
    id: &str,
) -> Result<Option<DeviceTypeEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::get_by_id(pool.as_ref(), id).await
}
