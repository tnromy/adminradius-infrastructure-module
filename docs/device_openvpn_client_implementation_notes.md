# Device OpenVPN Client Assignment Implementation Notes

## Overview
Implement feature to associate a device with an OpenVPN client (assign/unassign).

## Table Structure (from migration 20251030093438)
```sql
CREATE TABLE IF NOT EXISTS device_openvpn_clients (
    id                  VARCHAR(36) PRIMARY KEY,
    device_id           VARCHAR(36) NOT NULL REFERENCES devices(id),
    openvpn_client_id   VARCHAR(36) NOT NULL REFERENCES openvpn_clients(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id),           -- One device can have only one openvpn client
    UNIQUE(openvpn_client_id)    -- One openvpn client can be assigned to only one device
);
```

**Key Constraints:**
- One device can only be assigned to ONE openvpn client
- One openvpn client can only be assigned to ONE device
- Both are 1:1 relationship

## API Routes to Add

### Route Pattern (in device_route.rs)
```
PUT    /device/{device_id}/openvpn-client/{openvpn_client_id}   - Assign
DELETE /device/{device_id}/openvpn-client/{openvpn_client_id}   - Unassign
```

## Files to Create/Modify

### 1. Entity
- **File:** `src/entities/device_openvpn_client_entity.rs`
- **Fields:** id, device_id, openvpn_client_id, created_at, updated_at
- **Register in:** `src/entities/mod.rs`

### 2. Repository
- **File:** `src/repositories/postgresql/device_openvpn_client_postgres_repository.rs`
- **Functions needed:**
  - `create(executor, entity)` - Insert new assignment
  - `delete_by_device_and_client(executor, device_id, openvpn_client_id)` - Delete assignment
  - `find_by_device_id(executor, device_id)` - Check if device already assigned
  - `find_by_openvpn_client_id(executor, openvpn_client_id)` - Check if client already assigned
  - `exists(executor, device_id, openvpn_client_id)` - Check if specific assignment exists
- **Register in:** `src/repositories/postgresql/mod.rs`

### 3. Validation
**Files:**
- `src/validations/device/assign_openvpn_client_validation.rs`
- `src/validations/device/unassign_openvpn_client_validation.rs`

**Validation Logic for Assign:**
1. Validate device_id is valid UUID
2. Validate openvpn_client_id is valid UUID
3. Check device exists
4. Check device's device_type.name == 'Router' (JOIN with device_types table)
5. Check openvpn_client exists
6. Check device is not already assigned to another openvpn_client
7. Check openvpn_client is not already assigned to another device

**Validation Logic for Unassign:**
1. Validate device_id is valid UUID
2. Validate openvpn_client_id is valid UUID
3. Check assignment exists

**Register in:** `src/validations/device/mod.rs`

### 4. Services
**Files:**
- `src/services/assign_device_openvpn_client.rs`
- `src/services/unassign_device_openvpn_client.rs`

**Service Logic for Assign:**
1. Validate inputs
2. Check device exists and is of type 'Router'
3. Check openvpn_client exists
4. Check no existing assignment for device or client
5. Generate UUID for id
6. Create entity with current timestamp
7. Save to repository

**Service Logic for Unassign:**
1. Validate inputs
2. Check assignment exists
3. Delete from repository

**Register in:** `src/services/mod.rs`

### 5. Controller Methods
**File:** `src/controllers/device_controller.rs`

**Methods to add:**
- `assign_openvpn_client` - Handle PUT request
- `unassign_openvpn_client` - Handle DELETE request

**Path struct needed:**
```rust
pub struct DeviceOpenvpnClientPath {
    device_id: String,
    openvpn_client_id: String,
}
```

### 6. Routes
**File:** `src/routes/device_route.rs`

Add new resource:
```rust
cfg.service(
    web::resource("/device/{device_id}/openvpn-client/{openvpn_client_id}")
        .route(web::put().to(controller::assign_openvpn_client))
        .route(web::delete().to(controller::unassign_openvpn_client)),
);
```

### 7. OpenAPI Documentation
**New file:** `docs/openapi/group_device_openvpn_client.json`

**Register in:** `docs/openapi/infrastructure_service_adminradius.json`
- Add tag "Device OpenVPN Client"
- Add path reference for `/device/{device_id}/openvpn-client/{openvpn_client_id}`

## Implementation Order

1. Create entity `device_openvpn_client_entity.rs`
2. Create repository `device_openvpn_client_postgres_repository.rs`
3. Create validations (assign and unassign)
4. Create services (assign and unassign)
5. Update controller with new methods
6. Update routes
7. Create OpenAPI documentation
8. Compile and test

## Device Type Validation Query

To check if a device is of type 'Router':
```sql
SELECT d.id
FROM devices d
JOIN device_types dt ON d.device_type_id = dt.id
WHERE d.id = $1 AND dt.name = 'Router'
```

This can be implemented as a repository function in `device_postgres_repository.rs`:
```rust
pub async fn is_device_router(executor, device_id: &str) -> Result<bool, sqlx::Error>
```
