use crate::entities::device_entity::DeviceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_postgres_repository as device_repository;

pub async fn execute(
    db: &DatabaseConnection,
    branch_id: &str,
    search: Option<&str>,
) -> Result<Vec<DeviceEntity>, sqlx::Error> {
    let pool = db.get_pool();
    device_repository::get_all_by_branch(pool.as_ref(), branch_id, search).await
}
