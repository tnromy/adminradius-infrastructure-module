use openssl::hash::{Hasher, MessageDigest};

/// Generate a SHA-256 hash of the input string.
/// Returns the hash as a lowercase hexadecimal string.
pub fn sha256(input: &str) -> Result<String, String> {
    let mut hasher = Hasher::new(MessageDigest::sha256())
        .map_err(|e| format!("Failed to create hasher: {}", e))?;
    hasher
        .update(input.as_bytes())
        .map_err(|e| format!("Failed to update hasher: {}", e))?;
    let hash = hasher
        .finish()
        .map_err(|e| format!("Failed to finish hash: {}", e))?;
    Ok(hex::encode(hash))
}

/// Validate that the input matches the given SHA-256 hash.
pub fn validate_sha256(input: &str, expected_hash: &str) -> bool {
    match sha256(input) {
        Ok(computed_hash) => computed_hash.eq_ignore_ascii_case(expected_hash),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256() {
        let input = "test-string";
        let hash = sha256(input).unwrap();
        
        // SHA-256 hash should be 64 hex characters
        assert_eq!(hash.len(), 64);
        
        // Same input should produce same hash
        let hash2 = sha256(input).unwrap();
        assert_eq!(hash, hash2);
        
        // Different input should produce different hash
        let hash3 = sha256("different-string").unwrap();
        assert_ne!(hash, hash3);
    }

    #[test]
    fn test_validate_sha256() {
        let input = "test-string";
        let hash = sha256(input).unwrap();
        
        // Should validate correctly
        assert!(validate_sha256(input, &hash));
        
        // Case insensitive
        assert!(validate_sha256(input, &hash.to_uppercase()));
        
        // Wrong input should not validate
        assert!(!validate_sha256("wrong-string", &hash));
    }
}
