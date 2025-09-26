use crate::entities::device_port_entity::DevicePortEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_postgres_repository as device_port_repository;

pub async fn execute(
    db: &DatabaseConnection,
    device_id: &str,
) -> Result<Vec<DevicePortEntity>, sqlx::Error> {
    let pool = db.get_pool();
    device_port_repository::get_all_by_device(pool.as_ref(), device_id).await
}
