use crate::entities::device_port_entity::DevicePortEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_postgres_repository as device_port_repository;

pub async fn execute(
    db: &DatabaseConnection,
    device_id: &str,
    id: &str,
) -> Result<Option<DevicePortEntity>, sqlx::Error> {
    let pool = db.get_pool();
    device_port_repository::get_by_device_and_id(pool.as_ref(), device_id, id).await
}
