# Root CA Embed and Certificate Chain Implementation

## Overview

This document describes the implementation of embedding the Root CA certificate at compile time and the correct structure for CA chain and server certificates.

## Key Concepts

### Certificate Hierarchy

```
Root CA (embedded at compile time)
    └── Intermediate CA (from PKCS#12 bundle)
            └── Server Certificate (from PKCS#12 bundle)
```

### Column Definitions

| Column | Description | Content |
|--------|-------------|---------|
| `ca_chain_pem` | CA certificate chain | Root CA + Intermediate CA (in that order) |
| `certificate_pem` | Server certificate | The OpenVPN server's own certificate |
| `encrypted_private_key_pem` | Private key | Encrypted private key (PKCS#8 format) |

## Implementation Details

### 1. Root CA Entity (`src/entities/root_ca_entity.rs`)

- Stores the root CA PEM string
- Embedded at compile time via `include_bytes!` in the load_ca infrastructure
- Available as a static string throughout the application

### 2. Load CA Infrastructure (`src/infrastructures/load_ca.rs`)

- Uses `include_bytes!("../../config/root_ca.pem")` to embed root CA at compile time
- After build, `config/root_ca.pem` is no longer needed
- The root CA becomes part of the binary

### 3. Migration Changes

File: `migrations/20251030093417_create_openvpn_servers_table.up.sql`

Add new column after `ca_chain_pem`:
```sql
certificate_pem TEXT NOT NULL,
```

### 4. Files Affected

#### Entities
- `src/entities/root_ca_entity.rs` - NEW: Root CA PEM holder
- `src/entities/openvpn_server_entity.rs` - Add `certificate_pem` field
- `src/entities/mod.rs` - Add `root_ca_entity` module

#### Infrastructure
- `src/infrastructures/load_ca.rs` - NEW: Embed root CA at compile time
- `src/infrastructures/mod.rs` - Add `load_ca` module

#### Repository
- `src/repositories/postgresql/openvpn_server_postgres_repository.rs`
  - `row_to_entity`: Add `certificate_pem`
  - `create`: Add `certificate_pem` to INSERT
  - `get_by_id`: Add `certificate_pem` to SELECT
  - `get_all`: Add `certificate_pem` to SELECT

#### Services
- `src/services/add_openvpn_server.rs`
  - Get root CA PEM from `root_ca_entity`
  - Build `ca_chain_pem` as: `root_ca_pem + intermediate_ca_pem`
  - Set `certificate_pem` to server certificate from PKCS#12

#### OpenAPI
- `docs/openapi/group_openvpn_server.json`
  - Add `certificate_pem` field to `OpenvpnServer` schema
  - Update `ca_chain_pem` description to reflect correct content

## Correct Certificate Chain Logic

```rust
// CORRECT IMPLEMENTATION
// Root CA (from embedded binary)
let root_ca_pem = root_ca_entity::get_pem();

// Intermediate CA (from PKCS#12)
let intermediate_ca_pem = server_certificates.intermediate_ca_pem;

// Server certificate (from PKCS#12)
let certificate_pem = server_certificates.certificate_pem;

// CA Chain = Root CA + Intermediate CA
let ca_chain_pem = format!("{}{}", root_ca_pem, intermediate_ca_pem);
```

## Build vs Runtime Files

| File | Type | When Needed |
|------|------|-------------|
| `config/root_ca.pem` | Compile-time | Only during build |
| `config/default.json` | Runtime | Always needed, values can be changed |

