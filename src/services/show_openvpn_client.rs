use crate::entities::openvpn_client_entity::OpenvpnClientEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::openvpn_client_postgres_repository as repository;

pub async fn execute(
    db: &DatabaseConnection,
    id: &str,
) -> Result<Option<OpenvpnClientEntity>, sqlx::Error> {
    let pool = db.get_pool();
    repository::find_by_id(pool.as_ref(), id).await
}
