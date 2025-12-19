# OpenVPN Client Implementation Notes

## Overview

This document describes the implementation of OpenVPN client management functionality.

## Route Structure

### Routes in `openvpn_server_route.rs` (client operations scoped under server)
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/openvpn-server/{openvpn_server_id}/client` | `client_controller::store` | Create new client for server |
| GET | `/openvpn-server/{openvpn_server_id}/clients` | `client_controller::index` | List clients for server |

### Routes in `openvpn_client_route.rs` (standalone client operations)
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/openvpn-client/{id}` | `client_controller::show` | Get client details |
| DELETE | `/openvpn-client/{id}` | `client_controller::destroy` | Delete client |

## Database Schema (openvpn_clients table)

```sql
id                        VARCHAR(36) PRIMARY KEY
server_id                 VARCHAR(36) NOT NULL FK -> openvpn_servers(id)
cn                        VARCHAR(64) NOT NULL
reserved_ip_address       VARCHAR(45) NULL
certificate_pem           TEXT NOT NULL
encrypted_private_key_pem TEXT NOT NULL
revoked_at                TIMESTAMPTZ NULL
expired_at                TIMESTAMPTZ NOT NULL
created_at                TIMESTAMPTZ NOT NULL
updated_at                TIMESTAMPTZ NOT NULL
UNIQUE(server_id, cn)
```

## Entity Structure

### OpenvpnClientEntity (internal)
- All fields from database
- `encrypted_private_key_pem` included

### OpenvpnClientResponse (API response)
- Excludes `encrypted_private_key_pem` (sensitive)
- Uses `From<OpenvpnClientEntity>` trait

## Service Workflow: add_openvpn_client

1. **Validate server exists**
   - Call `show_openvpn_server::execute(db, openvpn_server_id)`
   - If None, return error ServerNotFound

2. **Get passphrase from config**
   - `config.get_string("ca_openvpn.default_passphrase")`

3. **Initialize CA service**
   - `CaOpenvpnService::new(config)`

4. **Create CSR for client**
   - Call `ca_openvpn_api_repository::create_csr_client(service, passphrase, name)`
   - Response contains: `certificate_request_id`, `reserved_ip_address`

5. **Approve CSR**
   - Call `ca_openvpn_api_repository::approve_csr(service, certificate_request_id)`
   - Response contains: `certificate_pem`, `expired_at`, `serial_number`

6. **Parse PKCS#12**
   - Call `parse_pkcs12_certificate::execute(service, serial_number, passphrase)`
   - Extract: `certificate_pem`, `encrypted_private_key_pem`
   - Note: Do NOT need `intermediate_ca_pem` for clients

7. **Create entity and save**
   - Generate UUID for id
   - Set `server_id` from input
   - Set `cn` from name or use reserved_ip_address as CN
   - Set `certificate_pem` from PKCS#12 parsed result
   - Set `encrypted_private_key_pem` from PKCS#12
   - Set `reserved_ip_address` from CSR response
   - Set `expired_at` from approve response
   - `revoked_at` = NULL

## API Request/Response

### Add Client Request
```json
{
  "name": "optional-client-name"  // Optional, can be null or omitted
}
```

### Client Response
```json
{
  "id": "uuid",
  "server_id": "uuid",
  "cn": "common-name",
  "reserved_ip_address": "10.8.9.5",
  "certificate_pem": "-----BEGIN CERTIFICATE-----...",
  "expired_at": "2028-12-18T05:53:19Z",
  "revoked_at": null,
  "created_at": "2025-12-19T05:53:19Z",
  "updated_at": "2025-12-19T05:53:19Z"
}
```

## Files to Create/Modify

### Create New Files
1. `src/entities/openvpn_client_entity.rs`
2. `src/repositories/postgresql/openvpn_client_postgres_repository.rs`
3. `src/services/add_openvpn_client.rs`
4. `src/services/get_openvpn_clients.rs`
5. `src/services/show_openvpn_client.rs`
6. `src/services/delete_openvpn_client.rs`
7. `src/controllers/openvpn_client_controller.rs`
8. `src/routes/openvpn_client_route.rs`
9. `src/validations/openvpn_client/mod.rs`
10. `src/validations/openvpn_client/store_validation.rs`
11. `docs/openapi/group_openvpn_client.json`

### Modify Existing Files
1. `src/entities/mod.rs` - Add `openvpn_client_entity`
2. `src/repositories/postgresql/mod.rs` - Add repository
3. `src/services/mod.rs` - Add services
4. `src/controllers/mod.rs` - Add controller
5. `src/routes/mod.rs` - Add route
6. `src/routes/openvpn_server_route.rs` - Add client routes
7. `src/validations/mod.rs` - Add validation module
8. `docs/openapi/infrastructure_service_adminradius.json` - Register OpenVPN client paths

## Validation Rules (store_validation)

- `openvpn_server_id`: Required, must be valid UUID (36 chars)
- `name`: Optional, max 64 chars, sanitized

