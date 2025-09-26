use crate::entities::device_port_specification_entity::DevicePortSpecificationEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_specification_postgres_repository as repository;

pub async fn execute(
    db: &DatabaseConnection,
    id: &str,
) -> Result<Option<DevicePortSpecificationEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::get_by_id(pool.as_ref(), id).await
}
