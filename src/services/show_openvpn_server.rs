use crate::entities::openvpn_server_entity::OpenvpnServerEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::openvpn_server_postgres_repository as repository;

pub async fn execute(
    db: &DatabaseConnection,
    id: &str,
) -> Result<Option<OpenvpnServerEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::get_by_id(pool.as_ref(), id).await
}
