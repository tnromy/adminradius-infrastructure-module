# Private Key Passphrase Feature Implementation

## Status: ✅ COMPLETED

## Overview

This document describes the implementation of per-private-key unique passphrases for OpenVPN server and client certificates. Instead of using a single `default_passphrase` for all private keys, each private key will have its own randomly generated passphrase stored in a new table.

## Current Flow

1. Get `default_passphrase` from config (`ca_openvpn.default_passphrase`)
2. Use `default_passphrase` to call CA OpenVPN API for CSR creation
3. Use `default_passphrase` to parse PKCS#12 certificate
4. Store `encrypted_private_key_pem` (encrypted with `default_passphrase`)

## New Flow

1. Generate random UUID as unique `passphrase` using `uuid_helper::generate()`
2. Get `default_passphrase` from config (now called `master_key`)
3. Use generated `passphrase` to call CA OpenVPN API for CSR creation
4. Use generated `passphrase` to parse PKCS#12 certificate
5. After successful certificate generation:
   - Hash `encrypted_private_key_pem` using SHA-256 → `private_key_hash`
   - Encrypt generated `passphrase` using `master_key` → `encrypted_passphrase`
   - Store in `private_keys_passphrases` table with random UUID as `id`
6. Store `encrypted_private_key_pem` as usual

## Database Schema

### Table: `private_keys_passphrases`

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| private_key_hash | TEXT | SHA-256 hash of encrypted_private_key_pem |
| encrypted_passphrase | TEXT | Passphrase encrypted with master_key |

## Files to Create/Modify

### New Files

1. **Migration Files**
   - `migrations/20251231031906_create_private_keys_passphrases_table.up.sql`
   - `migrations/20251231031906_create_private_keys_passphrases_table.down.sql`

2. **Entity**
   - `src/entities/private_key_passphrase_entity.rs`

3. **Repository**
   - `src/repositories/postgresql/private_key_passphrase_postgres_repository.rs`

4. **Hash Helper**
   - `src/utils/hash_helper.rs` - SHA-256 hash make and validate functions

### Files to Modify

1. **Services**
   - `src/services/add_openvpn_server.rs` - Implement new passphrase flow
   - `src/services/add_openvpn_client.rs` - Implement new passphrase flow

2. **Module Registration**
   - `src/entities/mod.rs` - Add private_key_passphrase_entity
   - `src/repositories/postgresql/mod.rs` - Add private_key_passphrase_postgres_repository
   - `src/utils/mod.rs` - Add hash_helper

## Helper Functions

### hash_helper.rs

```rust
// SHA-256 hash generation
pub fn sha256(input: &str) -> String

// Validate hash
pub fn validate_sha256(input: &str, hash: &str) -> bool
```

### Existing crypt_helper.rs

Already provides:
- `encrypt_string(plaintext: &str, passphrase: &str) -> Result<String, String>`
- `decrypt_string(encrypted: &str, passphrase: &str) -> Result<String, String>`

## Implementation Steps

1. Create migration files (up and down SQL)
2. Create hash_helper.rs utility
3. Create private_key_passphrase_entity.rs
4. Create private_key_passphrase_postgres_repository.rs
5. Register new modules in mod.rs files
6. Update add_openvpn_server.rs service
7. Update add_openvpn_client.rs service
8. Build and verify
9. Update OpenAPI documentation (if needed - no API changes)

## Security Benefits

- Each private key has a unique passphrase
- Passphrase is encrypted with master_key before storage
- Private key can be identified by its hash
- Compromise of one passphrase doesn't affect others

## Notes

- The `private_keys_passphrases` table is used internally by services
- No REST API endpoints needed for this table
- No OpenAPI documentation changes required (internal table)
