use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use openssl::hash::MessageDigest;
use openssl::pkcs5::pbkdf2_hmac;
use openssl::symm::{Cipher, decrypt, encrypt};
use openssl::rand::rand_bytes;

const KEY_SIZE: usize = 32; // AES-256
const IV_SIZE: usize = 16;  // AES block size
const SALT_SIZE: usize = 16;
const PBKDF2_ITERATIONS: usize = 10000;

/// Encrypt a plaintext string using AES-256-CBC with PBKDF2 key derivation.
/// Returns base64-encoded ciphertext with salt and IV prepended.
/// Format: base64(salt + iv + ciphertext)
pub fn encrypt_string(plaintext: &str, passphrase: &str) -> Result<String, String> {
    // Generate random salt and IV
    let mut salt = [0u8; SALT_SIZE];
    let mut iv = [0u8; IV_SIZE];
    rand_bytes(&mut salt).map_err(|e| format!("Failed to generate salt: {}", e))?;
    rand_bytes(&mut iv).map_err(|e| format!("Failed to generate IV: {}", e))?;

    // Derive key from passphrase using PBKDF2
    let mut key = [0u8; KEY_SIZE];
    pbkdf2_hmac(
        passphrase.as_bytes(),
        &salt,
        PBKDF2_ITERATIONS,
        MessageDigest::sha256(),
        &mut key,
    )
    .map_err(|e| format!("Failed to derive key: {}", e))?;

    // Encrypt using AES-256-CBC
    let cipher = Cipher::aes_256_cbc();
    let ciphertext = encrypt(cipher, &key, Some(&iv), plaintext.as_bytes())
        .map_err(|e| format!("Failed to encrypt: {}", e))?;

    // Combine salt + IV + ciphertext
    let mut result = Vec::with_capacity(SALT_SIZE + IV_SIZE + ciphertext.len());
    result.extend_from_slice(&salt);
    result.extend_from_slice(&iv);
    result.extend_from_slice(&ciphertext);

    // Base64 encode
    Ok(BASE64.encode(&result))
}

/// Decrypt a base64-encoded ciphertext string using AES-256-CBC.
/// Expects format: base64(salt + iv + ciphertext)
pub fn decrypt_string(encrypted: &str, passphrase: &str) -> Result<String, String> {
    // Base64 decode
    let data = BASE64
        .decode(encrypted)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    if data.len() < SALT_SIZE + IV_SIZE {
        return Err("Invalid encrypted data: too short".to_string());
    }

    // Extract salt, IV, and ciphertext
    let salt = &data[0..SALT_SIZE];
    let iv = &data[SALT_SIZE..SALT_SIZE + IV_SIZE];
    let ciphertext = &data[SALT_SIZE + IV_SIZE..];

    // Derive key from passphrase using PBKDF2
    let mut key = [0u8; KEY_SIZE];
    pbkdf2_hmac(
        passphrase.as_bytes(),
        salt,
        PBKDF2_ITERATIONS,
        MessageDigest::sha256(),
        &mut key,
    )
    .map_err(|e| format!("Failed to derive key: {}", e))?;

    // Decrypt using AES-256-CBC
    let cipher = Cipher::aes_256_cbc();
    let plaintext = decrypt(cipher, &key, Some(iv), ciphertext)
        .map_err(|e| format!("Failed to decrypt: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("Failed to convert to string: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let plaintext = "test-secret-password";
        let passphrase = "my-passphrase";

        let encrypted = encrypt_string(plaintext, passphrase).unwrap();
        let decrypted = decrypt_string(&encrypted, passphrase).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_decrypt_wrong_passphrase() {
        let plaintext = "test-secret-password";
        let passphrase = "my-passphrase";
        let wrong_passphrase = "wrong-passphrase";

        let encrypted = encrypt_string(plaintext, passphrase).unwrap();
        let result = decrypt_string(&encrypted, wrong_passphrase);

        assert!(result.is_err());
    }
}
