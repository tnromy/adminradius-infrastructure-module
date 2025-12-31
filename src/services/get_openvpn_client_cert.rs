use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::openvpn_client_postgres_repository;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GetOpenvpnClientCertError {
    #[error("OpenVPN client not found")]
    NotFound,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

/// Get the certificate PEM for an OpenVPN client
pub async fn execute(
    db: &DatabaseConnection,
    client_id: &str,
) -> Result<String, GetOpenvpnClientCertError> {
    let pool = db.get_pool();

    let client = openvpn_client_postgres_repository::find_by_id(pool.as_ref(), client_id)
        .await?
        .ok_or(GetOpenvpnClientCertError::NotFound)?;

    Ok(client.certificate_pem)
}
