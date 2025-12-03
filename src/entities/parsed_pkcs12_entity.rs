use serde::{Deserialize, Serialize};

/// Entity representing the parsed PKCS#12 certificate bundle.
///
/// Contains the extracted certificate components in PEM format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedPkcs12Entity {
    /// The intermediate CA certificate in PEM format
    pub intermediate_ca_pem: String,
    /// The client/server certificate in PEM format
    pub certificate_pem: String,
    /// The private key encrypted with the passphrase in PEM format (PKCS#8)
    pub encrypted_private_key_pem: String,
}
