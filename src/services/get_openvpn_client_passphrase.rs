use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::openvpn_client_postgres_repository;
use crate::repositories::postgresql::private_key_passphrase_postgres_repository;
use crate::utils::crypt_helper;
use crate::utils::hash_helper;
use config::Config;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GetOpenvpnClientPassphraseError {
    #[error("OpenVPN client not found")]
    ClientNotFound,
    #[error("Passphrase not found for this private key")]
    PassphraseNotFound,
    #[error("Failed to get config: {0}")]
    Config(String),
    #[error("Failed to hash private key: {0}")]
    Hash(String),
    #[error("Failed to decrypt passphrase: {0}")]
    Decryption(String),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

/// Get the decrypted passphrase for an OpenVPN client's private key
/// 
/// Flow:
/// 1. Find the client by ID
/// 2. Hash the encrypted_private_key_pem using SHA-256
/// 3. Lookup the passphrase in private_keys_passphrases by hash
/// 4. Get master key from config (ca_openvpn.default_passphrase)
/// 5. Decrypt the passphrase using the master key
pub async fn execute(
    db: &DatabaseConnection,
    config: &Config,
    client_id: &str,
) -> Result<String, GetOpenvpnClientPassphraseError> {
    let pool = db.get_pool();

    // 1. Find the client
    let client = openvpn_client_postgres_repository::find_by_id(pool.as_ref(), client_id)
        .await?
        .ok_or(GetOpenvpnClientPassphraseError::ClientNotFound)?;

    // 2. Hash the encrypted private key PEM
    let private_key_hash = hash_helper::sha256(&client.encrypted_private_key_pem)
        .map_err(|e| GetOpenvpnClientPassphraseError::Hash(e))?;

    // 3. Lookup passphrase by hash
    let passphrase_entity = private_key_passphrase_postgres_repository::find_by_hash(
        pool.as_ref(),
        &private_key_hash,
    )
    .await?
    .ok_or(GetOpenvpnClientPassphraseError::PassphraseNotFound)?;

    // 4. Get master key from config
    let master_key = config
        .get_string("ca_openvpn.default_passphrase")
        .map_err(|e| GetOpenvpnClientPassphraseError::Config(format!(
            "Failed to get ca_openvpn.default_passphrase: {}", e
        )))?;

    // 5. Decrypt the passphrase
    let decrypted_passphrase = crypt_helper::decrypt_string(
        &passphrase_entity.encrypted_passphrase,
        &master_key,
    )
    .map_err(|e| GetOpenvpnClientPassphraseError::Decryption(e))?;

    Ok(decrypted_passphrase)
}
