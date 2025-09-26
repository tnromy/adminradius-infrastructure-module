use crate::entities::device_type_entity::DeviceTypeEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_type_postgres_repository as repository;

pub async fn execute(db: &DatabaseConnection) -> Result<Vec<DeviceTypeEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::get_all(pool.as_ref()).await
}
