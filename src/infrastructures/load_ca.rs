//! `load_ca.rs`
//!
//! Certificate Authority loading utilities.
//!
//! This module provides access to the root CA certificate that is embedded
//! at compile time. The root CA is loaded from `config/root_ca.pem` during
//! compilation and becomes part of the binary.
//!
//! ## Compile-time Embedded
//! - `root_ca.pem` (root CA certificate) via `include_bytes!` in `root_ca_entity`
//!
//! ## Usage
//! After build, `config/root_ca.pem` is no longer needed as it becomes part
//! of the binary. Unlike `config/default.json` which is read at runtime,
//! the root CA is baked into the compiled executable.

use openssl::x509::X509;

use crate::entities::root_ca_entity;

/// Load and parse the embedded root CA certificate.
///
/// Returns the root CA as an OpenSSL X509 certificate object.
///
/// # Errors
/// Returns an error if the embedded PEM cannot be parsed as a valid X509 certificate.
pub fn load_root_ca() -> Result<X509, String> {
    let root_ca_pem = root_ca_entity::get_pem();
    X509::from_pem(root_ca_pem.as_bytes())
        .map_err(|e| format!("Failed to parse embedded root_ca.pem: {}", e))
}

/// Get the root CA certificate in PEM format.
///
/// This is a convenience function that delegates to `root_ca_entity::get_pem()`.
pub fn get_root_ca_pem() -> &'static str {
    root_ca_entity::get_pem()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_root_ca_success() {
        let result = load_root_ca();
        assert!(result.is_ok(), "Should successfully load root CA");
    }

    #[test]
    fn test_get_root_ca_pem_not_empty() {
        let pem = get_root_ca_pem();
        assert!(!pem.is_empty(), "Root CA PEM should not be empty");
    }
}
