# Response Secret Decryption Feature

## Context Summary

This document describes the implementation of returning decrypted secrets in API responses while keeping encrypted values in the database.

## Current State Analysis

### 1. Device RADIUS Client Activation (PUT /device/{device_id}/radius-client)

**Current Behavior:**
- **Service**: `activate_device_radius_client.rs`
- **Flow**:
  1. Generate UUID secret using `uuid_helper::generate()`
  2. Get `radius.default_passphrase` from config (master key)
  3. Call RADIUS API with plaintext secret
  4. Encrypt secret using `crypt_helper::encrypt_string(&secret, &passphrase)`
  5. Store encrypted secret in `device_radius_clients` table
  6. Return `DeviceRadiusClientEntity` with `encrypted_secret` field

**Problem**: Response contains `encrypted_secret` instead of plaintext secret

**Entity Structure**:
```rust
DeviceRadiusClientEntity {
    id: String,
    device_openvpn_client_id: String,
    radius_client_id: i32,
    encrypted_secret: String,  // ← Currently returned encrypted
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

**Encryption Details**:
- Algorithm: AES-256-CBC with PBKDF2 key derivation
- Master key: `config.radius.default_passphrase`
- Encrypted format: base64(salt + iv + ciphertext)
- Helper: `crypt_helper::encrypt_string()` and `decrypt_string()`

### 2. OpenVPN Client Creation (POST /openvpn-server/{openvpn_server_id}/client)

**Current Behavior:**
- **Service**: `add_openvpn_client.rs`
- **Flow**:
  1. Generate unique UUID passphrase per private key
  2. Get `ca_openvpn.default_passphrase` from config (master key)
  3. Create CSR with unique passphrase
  4. Approve certificate
  5. Parse PKCS#12 with unique passphrase
  6. Hash private key using `hash_helper::sha256()`
  7. Encrypt unique passphrase with master key
  8. Store in `private_keys_passphrases` table (hash → encrypted_passphrase)
  9. Store client in `openvpn_clients` table
  10. Return `OpenvpnClientEntity`

**Problem**: Response does NOT include passphrase (neither encrypted nor decrypted)

**Current Response Structure** (`OpenvpnClientResponse`):
```rust
OpenvpnClientResponse {
    id, server_id, cn, reserved_ip_address,
    certificate_pem,
    revoked_at, expired_at,
    created_at, updated_at
}
// Missing: passphrase field
```

**Passphrase Storage**:
- Table: `private_keys_passphrases`
- Fields: `id`, `private_key_hash`, `encrypted_passphrase`
- Link: Hash of `encrypted_private_key_pem` → encrypted passphrase
- Master key: `config.ca_openvpn.default_passphrase`

## Required Changes

### Task 1: Device RADIUS Client Response Enhancement

**Goal**: Return decrypted secret in response while keeping encrypted value in DB

**Changes Needed**:
1. Create `DeviceRadiusClientResponse` struct with `secret` field (plaintext)
2. Modify `activate_device_radius_client` service to return both entity and plaintext secret
3. Update controller to use new response struct
4. Update OpenAPI documentation

### Task 2: OpenVPN Client Response Enhancement  

**Goal**: Add passphrase field to response with decrypted value

**Changes Needed**:
1. Add `passphrase` field to `OpenvpnClientResponse`
2. Modify `add_openvpn_client` service to return passphrase along with entity
3. Update controller to pass passphrase to response
4. Update OpenAPI documentation

## Code Patterns Observed

### Naming Conventions
- **Services**: `{action}_{resource}.rs` (e.g., `activate_device_radius_client.rs`)
- **Entities**: `{resource}_entity.rs`
- **Controllers**: `{resource}_controller.rs`
- **Repositories**: `{resource}_{storage}_repository.rs`
- **Response structs**: `{Resource}Response`

### Service Pattern
- Input struct: `{Action}{Resource}Input`
- Error enum: `{Action}{Resource}Error`
- Execute function: `pub async fn execute(...) -> Result<Entity, Error>`

### Entity-Response Pattern
- Entity: Full database representation with all fields
- Response: Public API representation, may exclude sensitive fields
- Conversion: `impl From<Entity> for Response`

### Controller Pattern
- Path structs for route parameters
- Validation before service call
- Match on service result errors
- Helper functions: `ok_response()`, `bad_request_response()`, etc.

### OpenAPI Pattern
- Modular structure using `$ref`
- Main file: `infra.adminradius.com.json`
- Group files: `group_{resource}.json`
- Path format in refs: `~1` encodes `/` (JSON Pointer RFC 6901)

## Implementation Plan

### Phase 1: Device RADIUS Client Secret Decryption
1. Create `DeviceRadiusClientResponse` in entity file
2. Modify service to return plaintext secret alongside entity
3. Update controller to use response struct with decrypted secret
4. Update OpenAPI in `group_device_radius_client.json`

### Phase 2: OpenVPN Client Passphrase Addition
1. Add `passphrase` field to `OpenvpnClientResponse`
2. Modify service to return plaintext passphrase
3. Update controller to pass passphrase to response
4. Update OpenAPI in `group_openvpn_client.json`

### Phase 3: Documentation Verification
1. Verify all OpenAPI refs in main file
2. Test bundling with redocly
3. Validate response examples match new structure

## Security Considerations

- Secrets/passphrases only decrypted in-memory for response
- Database still stores encrypted values
- Master keys remain in config
- No logging of decrypted secrets
- Response sent over HTTPS (assumed by authentication middleware)

## File Locations

### To Modify
- `src/entities/device_radius_client_entity.rs`
- `src/services/activate_device_radius_client.rs`
- `src/controllers/device_controller.rs`
- `src/entities/openvpn_client_entity.rs`
- `src/services/add_openvpn_client.rs`
- `src/controllers/openvpn_client_controller.rs`
- `docs/openapi/group_device_radius_client.json`
- `docs/openapi/group_openvpn_client.json`
