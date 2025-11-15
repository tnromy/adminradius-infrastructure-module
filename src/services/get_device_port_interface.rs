use crate::entities::device_port_interface_entity::DevicePortInterfaceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_port_interface_postgres_repository as repository;

pub async fn execute(
    db: &DatabaseConnection,
    id: &str,
) -> Result<Option<DevicePortInterfaceEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::get_by_id(pool.as_ref(), id).await
}
