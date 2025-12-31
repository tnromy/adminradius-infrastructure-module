use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::openvpn_client_postgres_repository;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GetOpenvpnClientPrivkeyError {
    #[error("OpenVPN client not found")]
    NotFound,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

/// Get the encrypted private key PEM for an OpenVPN client
pub async fn execute(
    db: &DatabaseConnection,
    client_id: &str,
) -> Result<String, GetOpenvpnClientPrivkeyError> {
    let pool = db.get_pool();

    let client = openvpn_client_postgres_repository::find_by_id(pool.as_ref(), client_id)
        .await?
        .ok_or(GetOpenvpnClientPrivkeyError::NotFound)?;

    Ok(client.encrypted_private_key_pem)
}
