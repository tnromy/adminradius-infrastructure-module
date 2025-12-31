use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::openvpn_client_postgres_repository;
use crate::repositories::postgresql::openvpn_server_postgres_repository;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GetOpenvpnClientCaChainError {
    #[error("OpenVPN client not found")]
    ClientNotFound,
    #[error("OpenVPN server not found")]
    ServerNotFound,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

/// Get the CA chain PEM for an OpenVPN client by joining with its server
pub async fn execute(
    db: &DatabaseConnection,
    client_id: &str,
) -> Result<String, GetOpenvpnClientCaChainError> {
    let pool = db.get_pool();

    // Find the client first
    let client = openvpn_client_postgres_repository::find_by_id(pool.as_ref(), client_id)
        .await?
        .ok_or(GetOpenvpnClientCaChainError::ClientNotFound)?;

    // Get the server to retrieve ca_chain_pem
    let server = openvpn_server_postgres_repository::get_by_id(pool.as_ref(), &client.server_id)
        .await?
        .ok_or(GetOpenvpnClientCaChainError::ServerNotFound)?;

    Ok(server.ca_chain_pem)
}
