use openssl::pkcs12::Pkcs12;
use openssl::symm::Cipher;

use crate::entities::parsed_pkcs12_entity::ParsedPkcs12Entity;

/// Extract and parse a PKCS#12 certificate bundle.
///
/// This function parses a PKCS#12 DER binary and extracts:
/// - The client/server certificate (PEM format)
/// - The private key (re-encrypted with the provided passphrase, PEM format)
/// - The intermediate CA certificate from the chain (PEM format)
///
/// # Arguments
/// * `pkcs12_der` - The PKCS#12 bundle in DER format
/// * `pkcs12_password` - The password to decrypt the PKCS#12 bundle
/// * `passphrase` - The passphrase to use for re-encrypting the private key
///
/// # Returns
/// * `ParsedPkcs12Entity` containing the extracted certificate components in PEM format
///
/// # Errors
/// Returns an error if:
/// - Failed to parse PKCS#12 DER format
/// - Failed to decrypt PKCS#12 with the provided password
/// - No certificate found in PKCS#12 bundle
/// - No private key found in PKCS#12 bundle
/// - No intermediate CA found in the certificate chain
/// - Failed to convert certificate to PEM format
/// - Failed to encrypt private key with passphrase
pub fn extract_pkcs12(
    pkcs12_der: &[u8],
    pkcs12_password: &str,
    passphrase: &str,
) -> Result<ParsedPkcs12Entity, String> {
    // Parse PKCS#12 from DER format
    let pkcs12 = Pkcs12::from_der(pkcs12_der)
        .map_err(|e| format!("Failed to parse PKCS#12 DER: {}", e))?;

    // Decrypt and parse PKCS#12 contents
    let parsed = pkcs12
        .parse2(pkcs12_password)
        .map_err(|e| format!("Failed to decrypt PKCS#12: {}", e))?;

    // Extract the client/server certificate
    let certificate = parsed.cert.ok_or("No certificate found in PKCS#12")?;
    let certificate_pem = String::from_utf8(
        certificate
            .to_pem()
            .map_err(|e| format!("Failed to convert certificate to PEM: {}", e))?,
    )
    .map_err(|e| format!("Invalid UTF-8 in certificate PEM: {}", e))?;

    // Extract and re-encrypt the private key with the passphrase
    let private_key = parsed.pkey.ok_or("No private key found in PKCS#12")?;
    let encrypted_private_key_pem = String::from_utf8(
        private_key
            .private_key_to_pem_pkcs8_passphrase(Cipher::aes_256_cbc(), passphrase.as_bytes())
            .map_err(|e| format!("Failed to encrypt private key: {}", e))?,
    )
    .map_err(|e| format!("Invalid UTF-8 in private key PEM: {}", e))?;

    // Extract the intermediate CA from the certificate chain
    let ca_chain = parsed
        .ca
        .ok_or("No certificate chain found in PKCS#12")?;

    // Get the first certificate in the chain (should be the intermediate CA)
    let intermediate_ca = ca_chain
        .get(0)
        .ok_or("No intermediate CA found in certificate chain")?;
    let intermediate_ca_pem = String::from_utf8(
        intermediate_ca
            .to_pem()
            .map_err(|e| format!("Failed to convert intermediate CA to PEM: {}", e))?,
    )
    .map_err(|e| format!("Invalid UTF-8 in intermediate CA PEM: {}", e))?;

    Ok(ParsedPkcs12Entity {
        intermediate_ca_pem,
        certificate_pem,
        encrypted_private_key_pem,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_pkcs12_invalid_der() {
        let invalid_der = b"not a valid pkcs12";
        let result = extract_pkcs12(invalid_der, "password", "passphrase");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse PKCS#12"));
    }
}
