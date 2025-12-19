# Device Radius Client Implementation Notes

## Overview
Implement feature to activate and deactivate radius client for a device that has an assigned OpenVPN client.

## Hierarchy Understanding
1. **device_id** - A device (must be type 'Router')
2. **device_openvpn_client** - Association table when device is assigned an OpenVPN client
3. **device_radius_client** - Association table when device activates radius client (depends on device_openvpn_client)

A device can only activate radius client if it already has an assigned OpenVPN client.

## 1. Radius API Repository - Add Client Function

**File:** `src/repositories/api/radius_api_repository.rs`

**New Function:** `add_client()`
- Path: `/client`
- Method: POST
- Request Body:
```json
{
    "host": "10.8.0.4",
    "name": "router 1",
    "secret": "test1234",
    "description": "router 1",
    "vendor_id": 1
}
```
- Response:
```json
{
    "status": { "code": 200, "message": "Ok" },
    "request_id": "...",
    "data": { "id": 1 }
}
```
- Return: `AddRadiusClientResponse { id: i32 }`

**Struct needed:**
```rust
#[derive(Serialize)]
pub struct AddRadiusClientRequest {
    pub host: String,
    pub name: String,
    pub secret: String,
    pub description: String,
    pub vendor_id: i32,
}

#[derive(Deserialize)]
pub struct AddRadiusClientResponse {
    pub id: i32,
}
```

## 2. Migration - device_radius_clients table

**File:** `migrations/20251219095237_create_device_radius_clients_table.up.sql`

```sql
CREATE TABLE IF NOT EXISTS device_radius_clients (
    id                  VARCHAR(36) PRIMARY KEY,
    device_id           VARCHAR(36) NOT NULL REFERENCES devices(id) ON UPDATE CASCADE ON DELETE CASCADE,
    radius_client_id    INTEGER NOT NULL,
    encrypted_secret    TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id)
);
```

**Note:** `radius_client_id` is NOT a foreign key - it's an external ID from Radius service.

## 3. Entity

**File:** `src/entities/device_radius_client_entity.rs`

```rust
pub struct DeviceRadiusClientEntity {
    pub id: String,
    pub device_id: String,
    pub radius_client_id: i32,
    pub encrypted_secret: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

## 4. Repository

**File:** `src/repositories/postgresql/device_radius_client_postgres_repository.rs`

Functions:
- `create(executor, entity)` - Insert new record
- `find_by_device_id(executor, device_id)` - Find by device_id
- `delete_by_device_id(executor, device_id)` - Delete by device_id

## 5. Routes

**File:** `src/routes/device_route.rs`

Add new route:
```
PUT    /device/{device_id}/radius-client    - Activate (with body: { vendor_id: i32 })
DELETE /device/{device_id}/radius-client    - Deactivate
```

## 6. Validation

**Files:**
- `src/validations/device/activate_radius_client_validation.rs`
- `src/validations/device/deactivate_radius_client_validation.rs`

Activate validation:
- device_id must be valid UUID
- vendor_id must be positive integer

Deactivate validation:
- device_id must be valid UUID

## 7. Services

### activate_device_radius_client.rs

Steps:
1. Get device_openvpn_client by device_id → if not found, device has no OpenVPN client assigned
2. Get device details from device repository
3. Get openvpn_client details from openvpn_client repository
4. Generate `radius_client_secret` using uuid_helper
5. Call radius API to add client with:
   - host: openvpn_client.reserved_ip_address
   - name: device.name
   - secret: radius_client_secret
   - description: device.name
   - vendor_id: from input params
6. Get `radius_client_id` from response
7. Encrypt `radius_client_secret` using `radius.default_passphrase` from config
8. Create DeviceRadiusClientEntity and save to database

### deactivate_device_radius_client.rs

Steps:
1. Find device_radius_client by device_id
2. If not found, return error
3. Delete from database
4. (Optional) Call radius API to delete client - if needed

## 8. Controller

**File:** `src/controllers/device_controller.rs`

Add methods:
- `activate_radius_client` - Handle PUT request
- `deactivate_radius_client` - Handle DELETE request

Path struct:
```rust
pub struct DeviceRadiusClientPath {
    device_id: String,
}
```

Payload struct for activate:
```rust
pub struct ActivateRadiusClientPayload {
    vendor_id: i32,
}
```

## 9. OpenAPI Documentation

**New file:** `docs/openapi/group_device_radius_client.json`

Register in `docs/openapi/infrastructure_service_adminradius.json`:
- Add tag "Device Radius Client"
- Add path reference for `/device/{device_id}/radius-client`

## Secret Encryption

Reference from `add_openvpn_server.rs` - uses PKCS#12 with passphrase.
For radius secret, we can use simpler encryption with openssl:

```rust
// Get passphrase from config
let passphrase = config.get_string("radius.default_passphrase")?;

// Simple AES encryption or use openssl crate
// For consistency, we could store it encrypted similar to private keys
```

Actually, looking at the project, the encrypted_private_key_pem is already encrypted by the CA service.
For radius secret, we need to encrypt it ourselves. We can use a simple approach:
- Base64 encode the secret XORed with passphrase
- Or use openssl's symmetric encryption

For simplicity and security, let's use openssl symmetric encryption (AES-256-CBC).

## Implementation Order

1. Add migration files
2. Create entity `device_radius_client_entity.rs`
3. Create repository `device_radius_client_postgres_repository.rs`
4. Add `add_client()` function to radius_api_repository.rs
5. Create validations (activate and deactivate)
6. Create services (activate and deactivate)
7. Update controller with new methods
8. Update routes
9. Create OpenAPI documentation
10. Build and test
