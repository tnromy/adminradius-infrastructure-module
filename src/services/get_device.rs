use crate::entities::device_entity::DeviceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_postgres_repository as device_repository;

pub async fn execute(
    db: &DatabaseConnection,
    branch_id: &str,
    id: &str,
) -> Result<Option<DeviceEntity>, sqlx::Error> {
    let pool = db.get_pool();
    device_repository::get_by_branch_and_id(pool.as_ref(), branch_id, id).await
}
