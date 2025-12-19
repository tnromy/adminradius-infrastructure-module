use thiserror::Error;

use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_openvpn_client_postgres_repository as assignment_repository;

#[derive(Debug)]
pub struct UnassignDeviceOpenvpnClientInput {
    pub device_id: String,
    pub openvpn_client_id: String,
}

#[derive(Debug, Error)]
pub enum UnassignDeviceOpenvpnClientError {
    #[error("assignment not found")]
    AssignmentNotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UnassignDeviceOpenvpnClientInput,
) -> Result<(), UnassignDeviceOpenvpnClientError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    // Step 1: Check assignment exists
    if !assignment_repository::exists(conn, &input.device_id, &input.openvpn_client_id).await? {
        return Err(UnassignDeviceOpenvpnClientError::AssignmentNotFound);
    }

    // Step 2: Delete the assignment
    let deleted = assignment_repository::delete_by_device_and_client(
        conn,
        &input.device_id,
        &input.openvpn_client_id,
    )
    .await?;

    if !deleted {
        return Err(UnassignDeviceOpenvpnClientError::AssignmentNotFound);
    }

    log::debug!(
        "unassign_device_openvpn_client:deleted device_id={} openvpn_client_id={}",
        input.device_id,
        input.openvpn_client_id
    );

    Ok(())
}
