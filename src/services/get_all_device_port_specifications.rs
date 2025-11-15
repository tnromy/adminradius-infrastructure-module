use crate::entities::device_port_specification_entity::DevicePortSpecificationEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_specification_postgres_repository as repository;

pub async fn execute(
    db: &DatabaseConnection,
) -> Result<Vec<DevicePortSpecificationEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::get_all(pool.as_ref()).await
}
