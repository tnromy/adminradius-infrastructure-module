//! Root CA Entity
//!
//! This module provides access to the root CA certificate that is embedded
//! at compile time. The root CA PEM is baked into the binary and available
//! as a static string throughout the application lifetime.

use once_cell::sync::Lazy;

/// The root CA certificate PEM embedded at compile time.
/// This is loaded from `config/root_ca.pem` during compilation.
static ROOT_CA_PEM: Lazy<String> = Lazy::new(|| {
    let bytes = include_bytes!("../../config/root_ca.pem");
    String::from_utf8_lossy(bytes).to_string()
});

/// Returns the root CA certificate in PEM format.
///
/// This certificate is embedded at compile time from `config/root_ca.pem`.
/// After build, the file is no longer needed as it becomes part of the binary.
///
/// # Example
/// ```ignore
/// let root_ca = root_ca_entity::get_pem();
/// println!("Root CA:\n{}", root_ca);
/// ```
pub fn get_pem() -> &'static str {
    &ROOT_CA_PEM
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_root_ca_pem_is_not_empty() {
        let pem = get_pem();
        assert!(!pem.is_empty(), "Root CA PEM should not be empty");
    }

    #[test]
    fn test_root_ca_pem_starts_with_certificate_header() {
        let pem = get_pem();
        assert!(
            pem.contains("-----BEGIN CERTIFICATE-----"),
            "Root CA PEM should contain certificate header"
        );
    }
}
