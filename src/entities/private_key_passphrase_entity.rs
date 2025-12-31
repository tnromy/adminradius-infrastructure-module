use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Entity for storing encrypted passphrases associated with private keys.
/// Each private key has a unique passphrase stored encrypted.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PrivateKeyPassphraseEntity {
    pub id: String,
    /// SHA-256 hash of the encrypted_private_key_pem
    pub private_key_hash: String,
    /// Passphrase encrypted with master key (from config)
    pub encrypted_passphrase: String,
}
