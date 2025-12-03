# OpenVPN Server Add/Update Workflow - Implementation Notes

## Document Purpose
Internal AI agent notes for implementing the OpenVPN server certificate workflow changes.

---

## 1. Current State Analysis

### 1.1 Migration (openvpn_servers table)
**File:** `migrations/20251030093417_create_openvpn_servers_table.up.sql`

Current columns:
- id, name, host, port, proto, cipher, auth_algorithm
- tls_key_pem, tls_key_mode
- ca_chain_pem (TEXT NOT NULL) - currently required in request body
- remote_cert_tls_name, crl_distribution_point
- created_at, updated_at

**Missing column:** `encrypted_private_key_pem` (TEXT) - needs to be added

### 1.2 Entity
**File:** `src/entities/openvpn_server_entity.rs`

Current fields match migration. Need to add:
- `encrypted_private_key_pem: Option<String>` (or String if NOT NULL)

### 1.3 Current Add Service Flow
**File:** `src/services/add_openvpn_server.rs`

1. Receives input with `ca_chain_pem` from request body
2. Checks name uniqueness
3. Checks host+port uniqueness
4. Creates entity with provided ca_chain_pem
5. Saves to database
6. Refreshes cache

**Problem:** `ca_chain_pem` is provided manually instead of being auto-generated from CA.

### 1.4 Validation
**File:** `src/validations/openvpn_server/store_validation.rs`

Currently requires `ca_chain_pem` in `StoreOpenvpnServerPayload`.

---

## 2. Required Changes

### 2.1 Config
**File:** `config/default.json`

Add under `ca_openvpn`:
```json
"default_passphrase": "your-secure-passphrase-here"
```

### 2.2 Migration Update
**File:** `migrations/20251030093417_create_openvpn_servers_table.up.sql`

Add column after ca_chain_pem:
```sql
encrypted_private_key_pem  TEXT,
```

### 2.3 Entity Update
**File:** `src/entities/openvpn_server_entity.rs`

Add field:
```rust
pub encrypted_private_key_pem: Option<String>,
```

### 2.4 Repository Update
**File:** `src/repositories/postgresql/openvpn_server_postgres_repository.rs`

Functions to update:
- `row_to_entity()` - add encrypted_private_key_pem mapping
- `create()` - add column to INSERT
- `update()` - **DO NOT** include encrypted_private_key_pem (immutable)
- `get_by_id()` - add to SELECT
- `get_all()` - add to SELECT

### 2.5 Validation Updates

**store_validation.rs:**
- Remove `ca_chain_pem` from required fields in payload
- Remove `ca_chain_pem` from validated struct output
- Keep other validations

**update_validation.rs:**
- Remove `name` from payload (immutable)
- Remove `ca_chain_pem` from payload (immutable)
- Do not allow modification of certificate-related fields

### 2.6 Add Service Update
**File:** `src/services/add_openvpn_server.rs`

New flow:
1. Read `default_passphrase` from config
2. Initialize `CaOpenvpnService` infrastructure
3. Call `create_csr_server()` with (ca_service, passphrase, input.name)
   - Store result in `csr_server_data`
4. Call `approve_csr()` with (ca_service, csr_server_data.certificate_request_id)
   - Store result in `certificate_data`
5. Call `parse_pkcs12_certificate::execute()` with (ca_service, certificate_data.serial_number, passphrase)
   - Store result in `server_certificates`
6. Build `fullchain_pem`:
   ```rust
   let fullchain_pem = format!(
       "{}{}",
       server_certificates.certificate_pem,
       server_certificates.intermediate_ca_pem
   );
   ```
7. Create entity with:
   - `ca_chain_pem: fullchain_pem`
   - `encrypted_private_key_pem: server_certificates.encrypted_private_key_pem`
8. Save to database

### 2.7 Update Service Update
**File:** `src/services/update_openvpn_server.rs`

Rules:
- Cannot modify: `name`, `ca_chain_pem`, `encrypted_private_key_pem`
- Remove these from `UpdateOpenvpnServerInput`
- Fetch existing entity first to preserve immutable fields
- Update only allowed fields

### 2.8 Controller Updates
**File:** `src/controllers/openvpn_server_controller.rs`

- Update `store()` to pass config to service
- Update `update()` to handle new validation struct

---

## 3. OpenAPI Documentation Updates

### 3.1 OpenvpnServerCreateRequest
Remove:
- `ca_chain_pem` (auto-generated)

Keep:
- name, host, port, proto, cipher, auth_algorithm
- tls_key_pem, tls_key_mode, remote_cert_tls_name, crl_distribution_point

### 3.2 OpenvpnServerUpdateRequest
Remove:
- `name` (immutable)
- `ca_chain_pem` (immutable)

Keep:
- host, port, proto, cipher, auth_algorithm
- tls_key_pem, tls_key_mode, remote_cert_tls_name, crl_distribution_point

### 3.3 OpenvpnServer Schema
Add:
- `encrypted_private_key_pem` field

---

## 4. Error Handling

New error types for add_openvpn_server:
- `CaServiceError(String)` - CA API errors
- `CertificateGenerationError(String)` - PKCS#12 parsing errors
- `ConfigError(String)` - Missing config values

---

## 5. Dependencies/Imports

Add to add_openvpn_server.rs:
```rust
use config::Config;
use crate::infrastructures::ca_openvpn::CaOpenvpnService;
use crate::repositories::api::ca_openvpn_api_repository;
use crate::services::parse_pkcs12_certificate;
```

---

## 6. Implementation Order

1. ✅ Add `default_passphrase` to config
2. ✅ Update migration file
3. ✅ Update entity
4. ✅ Update repository (all functions)
5. ✅ Update store_validation
6. ✅ Update add_openvpn_server service
7. ✅ Update update_validation
8. ✅ Update update_openvpn_server service
9. ✅ Update controller if needed
10. ✅ Update OpenAPI docs
11. ✅ Run cargo check

---

## 7. Field Mapping

### Request to Entity (Add)

| Request Field | Auto-Generated? | Entity Field |
|--------------|-----------------|--------------|
| name | No | name |
| host | No | host |
| port | No (default 1194) | port |
| proto | No (default udp) | proto |
| cipher | No (optional) | cipher |
| auth_algorithm | No (default SHA256) | auth_algorithm |
| tls_key_pem | No (optional) | tls_key_pem |
| tls_key_mode | No (optional) | tls_key_mode |
| - | YES (from CA API) | ca_chain_pem |
| - | YES (from CA API) | encrypted_private_key_pem |
| remote_cert_tls_name | No (default server) | remote_cert_tls_name |
| crl_distribution_point | No (optional) | crl_distribution_point |

### Update Restrictions

| Field | Modifiable? |
|-------|------------|
| name | NO |
| host | YES |
| port | YES |
| proto | YES |
| cipher | YES |
| auth_algorithm | YES |
| tls_key_pem | YES |
| tls_key_mode | YES |
| ca_chain_pem | NO |
| encrypted_private_key_pem | NO |
| remote_cert_tls_name | YES |
| crl_distribution_point | YES |

---

Document created: 2025-12-03
Purpose: AI agent implementation reference
