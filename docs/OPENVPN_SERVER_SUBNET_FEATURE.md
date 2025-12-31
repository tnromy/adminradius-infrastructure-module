# OpenVPN Server Subnet Field Addition

## Context Summary

This document describes the implementation of adding a `subnet` field to the `openvpn_servers` table and all related components.

## Current State Analysis

### Database Migration

**File**: `migrations/20251030093417_create_openvpn_servers_table.up.sql`

Current table structure includes:
- id (VARCHAR(36) PRIMARY KEY)
- name (VARCHAR(255) NOT NULL, UNIQUE)
- host (VARCHAR(45) NOT NULL)
- port (INTEGER NOT NULL DEFAULT 1194)
- proto (VARCHAR(10) NOT NULL DEFAULT 'udp')
- cipher (VARCHAR(50) DEFAULT 'AES-256-CBC')
- auth_algorithm (VARCHAR(50) NOT NULL DEFAULT 'SHA256')
- tls_key_pem (TEXT)
- tls_key_mode (VARCHAR(10) DEFAULT NULL)
- ca_chain_pem (TEXT NOT NULL)
- certificate_pem (TEXT NOT NULL)
- encrypted_private_key_pem (TEXT)
- serial_number (BIGINT, UNIQUE)
- expired_at (TIMESTAMPTZ)
- remote_cert_tls_name (VARCHAR(100) NOT NULL DEFAULT 'server')
- crl_distribution_point (TEXT)
- created_at (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- updated_at (TIMESTAMPTZ NOT NULL DEFAULT NOW())

**Missing**: subnet field

### Entity Structure

**File**: `src/entities/openvpn_server_entity.rs`

Two structs:
1. `OpenvpnServerEntity` - Full database representation with all fields
2. `OpenvpnServerResponse` - Public API response (excludes encrypted_private_key_pem)

Both need subnet field added.

### Repository Layer

**File**: `src/repositories/postgresql/openvpn_server_postgres_repository.rs`

Functions to update:
- `row_to_entity()` - Map database row to entity
- `create()` - INSERT query with all fields
- `update()` - UPDATE query (mutable fields only)
- `get_by_id()` - SELECT query with all fields
- `get_all()` - SELECT query with all fields

### Service Layer

**Files**:
1. `src/services/add_openvpn_server.rs`
   - `AddOpenvpnServerInput` struct needs subnet field
   - Entity creation needs subnet assignment
   
2. `src/services/update_openvpn_server.rs`
   - `UpdateOpenvpnServerInput` struct needs subnet field
   - Update call needs subnet parameter

### Validation Layer

**Files**:
1. `src/validations/openvpn_server/store_validation.rs`
   - `StoreOpenvpnServerPayload` struct needs subnet field
   - `StoreOpenvpnServerValidated` struct needs subnet field
   - Validation logic for subnet format (CIDR notation)
   
2. `src/validations/openvpn_server/update_validation.rs`
   - `UpdateOpenvpnServerPayload` struct needs subnet field
   - `UpdateOpenvpnServerValidated` struct needs subnet field
   - Validation logic for subnet format

### Subnet Format Specification

- Format: CIDR notation (e.g., "10.8.9.0/24")
- Validation pattern: `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}`
- Max length: 18 characters (e.g., "255.255.255.255/32")
- Field type: VARCHAR(18) NOT NULL
- Optional: Can be empty string or None in input, but will have a default value

### Controller Layer

**File**: `src/controllers/openvpn_server_controller.rs` (implied, not read yet)
- Should pass subnet from validation to service input

### OpenAPI Documentation

**File**: `docs/openapi/group_openvpn_server.json`

Needs update in:
- Schema definition for OpenvpnServer
- POST request body schema
- PUT request body schema
- Response examples

## Implementation Plan

### Phase 1: Database Migration
1. Add `subnet VARCHAR(18) NOT NULL DEFAULT '10.8.0.0/24'` to table
2. Update down migration to drop the field

### Phase 2: Entity Layer
1. Add `subnet: String` to `OpenvpnServerEntity`
2. Add `subnet: String` to `OpenvpnServerResponse`
3. Update `From` trait implementation

### Phase 3: Repository Layer
1. Update `row_to_entity()` to map subnet field
2. Update `create()` INSERT to include subnet
3. Update `update()` to include subnet parameter
4. Update all SELECT queries to include subnet field

### Phase 4: Service Layer
1. Add `subnet` to `AddOpenvpnServerInput`
2. Add `subnet` to `UpdateOpenvpnServerInput`
3. Update entity creation in add service
4. Update update call parameters

### Phase 5: Validation Layer
1. Add `subnet` to all payload structs
2. Add `subnet` to all validated structs
3. Implement subnet CIDR validation
4. Set default to "10.8.0.0/24" if not provided

### Phase 6: OpenAPI Documentation
1. Add subnet field to OpenvpnServer schema
2. Update POST request body
3. Update PUT request body
4. Add examples with subnet values

### Phase 7: Compilation & Testing
1. Run cargo check
2. Verify all type signatures match
3. Fix any compilation errors

## Validation Rules for Subnet

```rust
// Validate subnet format (CIDR notation)
// Pattern: IP address (0-255 per octet) followed by /subnet_mask (0-32)
// Example: "10.8.9.0/24", "192.168.1.0/24", "172.16.0.0/16"

fn is_valid_cidr(subnet: &str) -> bool {
    // Regex pattern or manual parsing
    // Must have format: xxx.xxx.xxx.xxx/yy
    // Each xxx: 0-255
    // yy: 0-32
}

// Default value if not provided or invalid: "10.8.0.0/24"
```

## File Modification Checklist

- [ ] migrations/20251030093417_create_openvpn_servers_table.up.sql
- [ ] migrations/20251030093417_create_openvpn_servers_table.down.sql
- [ ] src/entities/openvpn_server_entity.rs
- [ ] src/repositories/postgresql/openvpn_server_postgres_repository.rs
- [ ] src/services/add_openvpn_server.rs
- [ ] src/services/update_openvpn_server.rs
- [ ] src/validations/openvpn_server/store_validation.rs
- [ ] src/validations/openvpn_server/update_validation.rs
- [ ] docs/openapi/group_openvpn_server.json

## Notes

- Since we're in dev phase, ALTER TABLE is not needed - direct migration file edit
- Subnet is mutable field (can be updated)
- Subnet is required field with default value
- No need to create new migration file - just edit existing one
