use crate::entities::device_connection_entity::DeviceConnectionEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_connection_postgres_repository as connection_repository;

pub async fn execute(
    db: &DatabaseConnection,
    device_id: &str,
    id: &str,
) -> Result<Option<DeviceConnectionEntity>, sqlx::Error> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    connection_repository::get_by_device_and_id(conn, device_id, id).await
}
