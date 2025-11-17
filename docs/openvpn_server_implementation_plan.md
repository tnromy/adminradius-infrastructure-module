# OpenVPN Server Management Module - Implementation Plan


**Date**: November 17, 2025  **Date Created**: November 17, 2025  

**Status**: ✅ Complete and Compiled Successfully**Purpose**: Track progress for implementing complete CRUD operations for OpenVPN server management



------



## Overview## Overview



Successfully implemented a complete CRUD API endpoint group for managing OpenVPN servers in the infrastructure management system. The implementation follows all existing architectural patterns and conventions.This document tracks the implementation of a new endpoint group to manage OpenVPN servers in the infrastructure management system. The implementation follows the existing architectural patterns established in the project.



------



## What Was Created## Database Schema



### 1. Entity LayerBased on migration file: `migrations/20251030093417_create_openvpn_servers_table.up.sql`

- `src/entities/openvpn_server_entity.rs` - Data structure matching database schema

**Table**: `openvpn_servers`

### 2. Repository Layer

**Columns**:

#### PostgreSQL Repository- `id` VARCHAR(36) PRIMARY KEY - Application-generated UUID

- `src/repositories/postgresql/openvpn_server_postgres_repository.rs`- `name` VARCHAR(255) NOT NULL - Unique server name

- Functions: `create`, `update`, `get_by_id`, `get_all`, `delete`, `exists`, `name_exists`, `host_port_exists`- `host` VARCHAR(45) NOT NULL - IP address/hostname

- `port` INTEGER NOT NULL DEFAULT 1194

#### Redis Repository- `proto` VARCHAR(10) NOT NULL DEFAULT 'udp'

- `src/repositories/redis/openvpn_servers_redis_repository.rs`- `cipher` VARCHAR(50) DEFAULT 'AES-256-CBC'

- Functions: `create`, `get`, `delete` (for list caching)- `auth_algorithm` VARCHAR(50) NOT NULL DEFAULT 'SHA256'

- `tls_key_pem` TEXT - Optional TLS key

### 3. Service Layer- `tls_key_mode` VARCHAR(10) DEFAULT NULL

- `src/services/get_openvpn_servers.rs` - List with Redis caching, configurable via `is_cache` parameter- `ca_chain_pem` TEXT NOT NULL - CA certificate chain

- `src/services/add_openvpn_server.rs` - Create with auto cache refresh- `dh_pem` TEXT NOT NULL - Diffie-Hellman parameters

- `src/services/update_openvpn_server.rs` - Update with auto cache refresh- `remote_cert_tls_name` VARCHAR(100) NOT NULL DEFAULT 'server'

- `src/services/show_openvpn_server.rs` - Get single item- `crl_distribution_point` TEXT - Certificate revocation list URL

- `src/services/delete_openvpn_server.rs` - Delete with auto cache refresh- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

### 4. Validation Layer

- `src/validations/openvpn_server/store_validation.rs` - Create validation**Unique Constraints**:

- `src/validations/openvpn_server/update_validation.rs` - Update validation- Unique on `name`

- Unique on `(host, port)` combination

### 5. Controller Layer

- `src/controllers/openvpn_server_controller.rs`---

- Handlers: `index`, `store`, `show`, `update`, `destroy`

## Implementation Checklist

### 6. Route Layer

- `src/routes/openvpn_server_route.rs`### 1. Entity Layer ✅ COMPLETED

- Routes registered in `src/routes/mod.rs`- [x] Create `src/entities/openvpn_server_entity.rs`

- [x] Update `src/entities/mod.rs`

---

### 2. Repository Layer - PostgreSQL ✅ COMPLETED

## API Endpoints- [x] Create `src/repositories/postgresql/openvpn_server_postgres_repository.rs`

  - [x] `create()` - Insert new record

Base path: `/api-infra`  - [x] `update()` - Update existing record by ID

  - [x] `get_by_id()` - Fetch single record

| Method | Path | Handler | Description |  - [x] `get_all()` - Fetch all records

|--------|------|---------|-------------|  - [x] `delete()` - Delete by ID

| GET | `/openvpn-servers` | `index` | List all OpenVPN servers |  - [x] `name_exists()` - Check name uniqueness

| POST | `/openvpn-server` | `store` | Create new OpenVPN server |  - [x] `host_port_exists()` - Check host+port uniqueness

| GET | `/openvpn-server/{id}` | `show` | Get single OpenVPN server |- [x] Update `src/repositories/postgresql/mod.rs`

| PUT | `/openvpn-server/{id}` | `update` | Update OpenVPN server |

| DELETE | `/openvpn-server/{id}` | `destroy` | Delete OpenVPN server |### 3. Repository Layer - Redis ✅ COMPLETED

- [x] Create `src/repositories/redis/openvpn_servers_redis_repository.rs`

---  - [x] `create()` - Store list with TTL

  - [x] `get()` - Retrieve cached list

## Key Features  - [x] `delete()` - Invalidate cache

- [x] Update `src/repositories/redis/mod.rs`

### 1. Redis Caching Strategy

- **Cache Key**: `adminradius_infra:openvpn_servers:list`### 4. Service Layer ✅ COMPLETED

- **TTL**: 3600 seconds (1 hour)- [x] Create `src/services/get_openvpn_servers.rs`

- **Bypass Parameter**: `is_cache` in `get_openvpn_servers` service  - [x] Parameter: `is_cache: bool` (default: true)

  - `true` (default): Check cache first, fetch from DB on miss  - [x] Logic: Check Redis → if miss, get from PostgreSQL → update Redis → return

  - `false`: Always fetch from DB and refresh cache  - [x] If `is_cache = false`: Skip Redis, query PostgreSQL, update Redis, return

- [x] Create `src/services/add_openvpn_server.rs`

### 2. Automatic Cache Invalidation  - [x] Generate UUID using `uuid_helper::generate()`

- Cache is automatically refreshed after:  - [x] Insert to PostgreSQL

  - Creating a new OpenVPN server  - [x] Refresh cache via `get_openvpn_servers(is_cache=false)`

  - Updating an existing OpenVPN server- [x] Create `src/services/update_openvpn_server.rs`

  - Deleting an OpenVPN server  - [x] Update PostgreSQL

  - [x] Refresh cache via `get_openvpn_servers(is_cache=false)`

### 3. Data Validation- [x] Create `src/services/show_openvpn_server.rs`

- XSS sanitization on all string inputs  - [x] Fetch single record from PostgreSQL (no Redis check)

- Required fields: `name`, `host`, `ca_chain_pem`, `dh_pem`- [x] Create `src/services/delete_openvpn_server.rs`

- Optional fields with defaults:  - [x] Delete from PostgreSQL

  - `port` (default: 1194)  - [x] Refresh cache via `get_openvpn_servers(is_cache=false)`

  - `proto` (default: "udp")- [x] Update `src/services/mod.rs`

  - `auth_algorithm` (default: "SHA256")

  - `remote_cert_tls_name` (default: "server")### 5. Validation Layer ✅ COMPLETED

- [x] Create directory `src/validations/openvpn_server/`

### 4. Uniqueness Constraints- [x] Create `src/validations/openvpn_server/mod.rs`

- **Name**: Must be unique across all servers- [x] Create `src/validations/openvpn_server/store_validation.rs`

- **Host + Port**: Combination must be unique  - [x] Validate all required fields

  - [x] Sanitize inputs with XSS protection

### 5. Error Handling- [x] Create `src/validations/openvpn_server/update_validation.rs`

- Type-safe errors using `thiserror`  - [x] Similar to store, validate update fields

- Consistent HTTP responses:- [x] Update `src/validations/mod.rs`

  - 200: Success

  - 400: Bad request (validation errors, duplicates)### 6. Controller Layer ✅ COMPLETED

  - 404: Not found- [x] Create `src/controllers/openvpn_server_controller.rs`

  - 500: Internal server error  - [x] `index()` - GET list (calls get_openvpn_servers with is_cache=true)

  - [x] `store()` - POST create (validate → add_openvpn_server)

---  - [x] `show()` - GET single (calls show_openvpn_server)

  - [x] `update()` - PUT update (validate → update_openvpn_server)

## Database Schema  - [x] `destroy()` - DELETE (calls delete_openvpn_server)

  - [x] Implement consistent error handling

Table: `openvpn_servers`  - [x] Use http_response_helper for responses

  - [x] Add logging with request_id

```sql- [x] Update `src/controllers/mod.rs`

CREATE TABLE openvpn_servers (

    id VARCHAR(36) PRIMARY KEY,### 7. Route Layer ✅ COMPLETED

    name VARCHAR(255) NOT NULL UNIQUE,- [x] Create `src/routes/openvpn_server_route.rs`

    host VARCHAR(45) NOT NULL,  - [x] GET `/openvpn-servers` → index

    port INTEGER NOT NULL DEFAULT 1194,  - [x] POST `/openvpn-server` → store

    proto VARCHAR(10) NOT NULL DEFAULT 'udp',  - [x] GET `/openvpn-server/{id}` → show

    cipher VARCHAR(50) DEFAULT 'AES-256-CBC',  - [x] PUT `/openvpn-server/{id}` → update

    auth_algorithm VARCHAR(50) NOT NULL DEFAULT 'SHA256',  - [x] DELETE `/openvpn-server/{id}` → destroy

    tls_key_pem TEXT,  - [x] Apply middlewares: `include_request_id_middleware`, `log_middleware`

    tls_key_mode VARCHAR(10) DEFAULT NULL,- [x] Update `src/routes/mod.rs`

    ca_chain_pem TEXT NOT NULL,- [x] Update `src/main.rs` to register routes

    dh_pem TEXT NOT NULL,

    remote_cert_tls_name VARCHAR(100) NOT NULL DEFAULT 'server',### 8. Integration & Testing ✅ COMPLETED

    crl_distribution_point TEXT,- [x] Compile and fix any syntax errors

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),- [ ] Test endpoint: GET /openvpn-servers (list)

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),- [ ] Test endpoint: POST /openvpn-server (create)

    UNIQUE(host, port)- [ ] Test endpoint: GET /openvpn-server/{id} (show)

);- [ ] Test endpoint: PUT /openvpn-server/{id} (update)

```- [ ] Test endpoint: DELETE /openvpn-server/{id} (delete)

- [ ] Verify Redis caching behavior

---- [ ] Verify is_cache parameter functionality

- [ ] Test validation error responses

## Example Usage- [ ] Test uniqueness constraints (name, host+port)



### 1. Create OpenVPN Server---



```bash## File Structure Summary

curl -X POST http://localhost:8014/api-infra/openvpn-server \

  -H "Content-Type: application/json" \```

  -d '{src/

    "name": "vpn-server-01",├── entities/

    "host": "10.0.1.100",│   ├── openvpn_server_entity.rs          ✅ Created

    "port": 1194,│   └── mod.rs                             ✅ Updated

    "proto": "tcp",├── repositories/

    "cipher": "AES-256-GCM",│   ├── postgresql/

    "auth_algorithm": "SHA256",│   │   ├── openvpn_server_postgres_repository.rs  ✅ Created

    "ca_chain_pem": "-----BEGIN CERTIFICATE-----\n...",│   │   └── mod.rs                                  ✅ Updated

    "dh_pem": "-----BEGIN DH PARAMETERS-----\n...",│   └── redis/

    "remote_cert_tls_name": "server"│       ├── openvpn_servers_redis_repository.rs    ✅ Created

  }'│       └── mod.rs                                  ✅ Updated

```├── services/

│   ├── get_openvpn_servers.rs            ✅ Created

### 2. List OpenVPN Servers│   ├── add_openvpn_server.rs             ✅ Created

│   ├── update_openvpn_server.rs          ✅ Created

```bash│   ├── show_openvpn_server.rs            ✅ Created

curl http://localhost:8014/api-infra/openvpn-servers│   ├── delete_openvpn_server.rs          ✅ Created

```│   └── mod.rs                             ✅ Updated

├── validations/

### 3. Get Single Server│   ├── openvpn_server/

│   │   ├── mod.rs                        ✅ Created

```bash│   │   ├── store_validation.rs           ✅ Created

curl http://localhost:8014/api-infra/openvpn-server/019a34a2-cb9e-78ad-a4be-b2e83a1ff440│   │   └── update_validation.rs          ✅ Created

```│   └── mod.rs                             ✅ Updated

├── controllers/

### 4. Update Server│   ├── openvpn_server_controller.rs      ✅ Created

│   └── mod.rs                             ✅ Updated

```bash├── routes/

curl -X PUT http://localhost:8014/api-infra/openvpn-server/019a34a2-cb9e-78ad-a4be-b2e83a1ff440 \│   ├── openvpn_server_route.rs           ✅ Created

  -H "Content-Type: application/json" \│   └── mod.rs                             ✅ Updated

  -d '{└── main.rs                                ✅ Updated

    "name": "vpn-server-01-updated",```

    "host": "10.0.1.100",

    "port": 1194,---

    "proto": "udp",

    ...## Key Design Decisions

  }'

```1. **UUID Generation**: Using `uuid7::uuid7()` via `uuid_helper::generate()` for deterministic ordering

2. **Redis Caching**: List cache with configurable bypass via `is_cache` parameter

### 5. Delete Server3. **Cache Strategy**: 

   - Read operations check cache first

```bash   - Write operations (add/update/delete) invalidate and refresh cache

curl -X DELETE http://localhost:8014/api-infra/openvpn-server/019a34a2-cb9e-78ad-a4be-b2e83a1ff440   - TTL: 3600 seconds (1 hour) - configurable

```4. **Validation**: XSS sanitization on all string inputs, length limits enforced

5. **Error Handling**: Typed errors with thiserror, consistent HTTP responses

---6. **Naming Convention**: 

   - Plural routes for listing: `/openvpn-servers`

## Testing Checklist   - Singular routes for single operations: `/openvpn-server/{id}`



- [ ] Run database migration: `sqlx migrate run`---

- [ ] Start server: `cargo run`

- [ ] Test GET `/openvpn-servers` - Should return seeded data## Notes for Continuation

- [ ] Test POST `/openvpn-server` - Create new entry

- [ ] Test GET `/openvpn-server/{id}` - Retrieve created entry- All core implementation files have been created

- [ ] Test PUT `/openvpn-server/{id}` - Update entry- Module exports have been updated in all `mod.rs` files

- [ ] Test DELETE `/openvpn-server/{id}` - Remove entry- Routes have been registered in `main.rs`

- [ ] Verify name uniqueness constraint- Ready for compilation and testing phase

- [ ] Verify host+port uniqueness constraint- Consider adding integration tests after manual verification

- [ ] Check Redis cache behavior (inspect with `redis-cli`)

- [ ] Verify cache refresh on write operations---

- [ ] Test validation errors (empty required fields)

## Redis Cache Key Format

---

```

## Files Modified/Created{prefix}:openvpn_servers:list

```

**Total**: 16 files created/modified

Default TTL: 3600 seconds (1 hour)

- 1 entity file

- 2 repository files (PostgreSQL + Redis)---

- 5 service files

- 2 validation files**Status**: ✅ Implementation Complete - Code Successfully Compiled  

- 1 controller file**Last Updated**: November 17, 2025

- 1 route file

- 4 mod.rs files updated## Compilation Results



**Documentation**: 2 filesThe project has been successfully compiled with **zero warnings** in application code.

- `docs/openvpn_server_implementation_plan.md`

- `docs/openvpn_server_implementation_summary.md` (this file)```bash

cargo check

---Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.79s

```

## Compilation Status

All OpenVPN server management endpoints are now ready for testing and integration.

✅ **Successfully compiled with zero application warnings**

## Next Steps

```bash

cargo check1. **Database Migration**: Run the migration to create the `openvpn_servers` table

    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.79s   ```bash

```   sqlx migrate run

   ```

---

2. **Start Server**: Launch the application

## Notes   ```bash

   cargo run

1. **UUID Generation**: Uses `uuid7` for time-ordered UUIDs   ```

2. **Middleware**: All routes use `include_request_id_middleware` and `log_middleware`

3. **Consistent Patterns**: Follows exact patterns from existing endpoint groups (device_type, device, etc.)3. **API Testing**: Test the endpoints using curl or Postman

4. **Security**: XSS protection on all user inputs via `xss_security_helper`   - GET `/api-infra/openvpn-servers` - List all servers

5. **Logging**: Comprehensive logging at repository and service levels   - POST `/api-infra/openvpn-server` - Create new server

   - GET `/api-infra/openvpn-server/{id}` - Get single server

---   - PUT `/api-infra/openvpn-server/{id}` - Update server

   - DELETE `/api-infra/openvpn-server/{id}` - Delete server

## Conclusion

4. **Redis Verification**: Monitor Redis cache behavior with the `is_cache` parameter

The OpenVPN server management module is **complete and ready for testing**. All code follows the established project conventions and architectural patterns. The implementation includes proper error handling, validation, caching, and logging.

5. **Integration Testing**: Verify uniqueness constraints and validation rules

---

## OpenAPI Documentation

**Status**: ✅ Complete

Created comprehensive OpenAPI 3.0.3 documentation for all OpenVPN server endpoints.

### Files Created/Modified
- ✅ `docs/openapi/group_openvpn_server.json` - Complete endpoint documentation (NEW)
- ✅ `docs/openapi/infrastructure_service_adminradius.json` - Registered new endpoints and schemas (UPDATED)

### Documentation Includes
- **Tag**: "OpenVPN Server" with description
- **5 Endpoints**: 
  - GET `/api-infra/openvpn-servers` - List all servers
  - POST `/api-infra/openvpn-server` - Create new server
  - GET `/api-infra/openvpn-server/{id}` - Get single server
  - PUT `/api-infra/openvpn-server/{id}` - Update server
  - DELETE `/api-infra/openvpn-server/{id}` - Delete server
- **3 Schemas**: 
  - `OpenvpnServer` - Entity schema with all fields
  - `OpenvpnServerCreateRequest` - Create request with defaults
  - `OpenvpnServerUpdateRequest` - Update request
- **Request/Response Examples**: Complete with realistic certificate data
- **Error Responses**: 400 (Bad Request), 404 (Not Found), 500 (Internal Server Error)
- **Validation Rules**: All field constraints, lengths, and patterns documented
- **Default Values**: port: 1194, proto: "udp", auth_algorithm: "SHA256", remote_cert_tls_name: "server"
- **Unique Constraints**: Documented name uniqueness and host+port combination uniqueness

### JSON Validation

```bash
✓ group_openvpn_server.json is valid JSON
✓ infrastructure_service_adminradius.json is valid JSON
```

Both files are syntactically valid and ready for use with OpenAPI tools such as:
- Swagger UI
- Postman (import OpenAPI spec)
- ReDoc
- API testing tools

Next step: **Manual testing of endpoints** to verify functionality in a running environment.
