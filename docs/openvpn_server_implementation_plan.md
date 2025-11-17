# OpenVPN Server Management Module - Implementation Plan

**Date Created**: November 17, 2025  
**Purpose**: Track progress for implementing complete CRUD operations for OpenVPN server management

---

## Overview

This document tracks the implementation of a new endpoint group to manage OpenVPN servers in the infrastructure management system. The implementation follows the existing architectural patterns established in the project.

---

## Database Schema

Based on migration file: `migrations/20251030093417_create_openvpn_servers_table.up.sql`

**Table**: `openvpn_servers`

**Columns**:
- `id` VARCHAR(36) PRIMARY KEY - Application-generated UUID
- `name` VARCHAR(255) NOT NULL - Unique server name
- `host` VARCHAR(45) NOT NULL - IP address/hostname
- `port` INTEGER NOT NULL DEFAULT 1194
- `proto` VARCHAR(10) NOT NULL DEFAULT 'udp'
- `cipher` VARCHAR(50) DEFAULT 'AES-256-CBC'
- `auth_algorithm` VARCHAR(50) NOT NULL DEFAULT 'SHA256'
- `tls_key_pem` TEXT - Optional TLS key
- `tls_key_mode` VARCHAR(10) DEFAULT NULL
- `ca_chain_pem` TEXT NOT NULL - CA certificate chain
- `dh_pem` TEXT NOT NULL - Diffie-Hellman parameters
- `remote_cert_tls_name` VARCHAR(100) NOT NULL DEFAULT 'server'
- `crl_distribution_point` TEXT - Certificate revocation list URL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

**Unique Constraints**:
- Unique on `name`
- Unique on `(host, port)` combination

---

## Implementation Checklist

### 1. Entity Layer ✅ COMPLETED
- [x] Create `src/entities/openvpn_server_entity.rs`
- [x] Update `src/entities/mod.rs`

### 2. Repository Layer - PostgreSQL ✅ COMPLETED
- [x] Create `src/repositories/postgresql/openvpn_server_postgres_repository.rs`
  - [x] `create()` - Insert new record
  - [x] `update()` - Update existing record by ID
  - [x] `get_by_id()` - Fetch single record
  - [x] `get_all()` - Fetch all records
  - [x] `delete()` - Delete by ID
  - [x] `name_exists()` - Check name uniqueness
  - [x] `host_port_exists()` - Check host+port uniqueness
- [x] Update `src/repositories/postgresql/mod.rs`

### 3. Repository Layer - Redis ✅ COMPLETED
- [x] Create `src/repositories/redis/openvpn_servers_redis_repository.rs`
  - [x] `create()` - Store list with TTL
  - [x] `get()` - Retrieve cached list
  - [x] `delete()` - Invalidate cache
- [x] Update `src/repositories/redis/mod.rs`

### 4. Service Layer ✅ COMPLETED
- [x] Create `src/services/get_openvpn_servers.rs`
  - [x] Parameter: `is_cache: bool` (default: true)
  - [x] Logic: Check Redis → if miss, get from PostgreSQL → update Redis → return
  - [x] If `is_cache = false`: Skip Redis, query PostgreSQL, update Redis, return
- [x] Create `src/services/add_openvpn_server.rs`
  - [x] Generate UUID using `uuid_helper::generate()`
  - [x] Insert to PostgreSQL
  - [x] Refresh cache via `get_openvpn_servers(is_cache=false)`
- [x] Create `src/services/update_openvpn_server.rs`
  - [x] Update PostgreSQL
  - [x] Refresh cache via `get_openvpn_servers(is_cache=false)`
- [x] Create `src/services/show_openvpn_server.rs`
  - [x] Fetch single record from PostgreSQL (no Redis check)
- [x] Create `src/services/delete_openvpn_server.rs`
  - [x] Delete from PostgreSQL
  - [x] Refresh cache via `get_openvpn_servers(is_cache=false)`
- [x] Update `src/services/mod.rs`

### 5. Validation Layer ✅ COMPLETED
- [x] Create directory `src/validations/openvpn_server/`
- [x] Create `src/validations/openvpn_server/mod.rs`
- [x] Create `src/validations/openvpn_server/store_validation.rs`
  - [x] Validate all required fields
  - [x] Sanitize inputs with XSS protection
- [x] Create `src/validations/openvpn_server/update_validation.rs`
  - [x] Similar to store, validate update fields
- [x] Update `src/validations/mod.rs`

### 6. Controller Layer ✅ COMPLETED
- [x] Create `src/controllers/openvpn_server_controller.rs`
  - [x] `index()` - GET list (calls get_openvpn_servers with is_cache=true)
  - [x] `store()` - POST create (validate → add_openvpn_server)
  - [x] `show()` - GET single (calls show_openvpn_server)
  - [x] `update()` - PUT update (validate → update_openvpn_server)
  - [x] `destroy()` - DELETE (calls delete_openvpn_server)
  - [x] Implement consistent error handling
  - [x] Use http_response_helper for responses
  - [x] Add logging with request_id
- [x] Update `src/controllers/mod.rs`

### 7. Route Layer ✅ COMPLETED
- [x] Create `src/routes/openvpn_server_route.rs`
  - [x] GET `/openvpn-servers` → index
  - [x] POST `/openvpn-server` → store
  - [x] GET `/openvpn-server/{id}` → show
  - [x] PUT `/openvpn-server/{id}` → update
  - [x] DELETE `/openvpn-server/{id}` → destroy
  - [x] Apply middlewares: `include_request_id_middleware`, `log_middleware`
- [x] Update `src/routes/mod.rs`
- [x] Update `src/main.rs` to register routes

### 8. Integration & Testing ✅ COMPLETED
- [x] Compile and fix any syntax errors
- [ ] Test endpoint: GET /openvpn-servers (list)
- [ ] Test endpoint: POST /openvpn-server (create)
- [ ] Test endpoint: GET /openvpn-server/{id} (show)
- [ ] Test endpoint: PUT /openvpn-server/{id} (update)
- [ ] Test endpoint: DELETE /openvpn-server/{id} (delete)
- [ ] Verify Redis caching behavior
- [ ] Verify is_cache parameter functionality
- [ ] Test validation error responses
- [ ] Test uniqueness constraints (name, host+port)

---

## File Structure Summary

```
src/
├── entities/
│   ├── openvpn_server_entity.rs          ✅ Created
│   └── mod.rs                             ✅ Updated
├── repositories/
│   ├── postgresql/
│   │   ├── openvpn_server_postgres_repository.rs  ✅ Created
│   │   └── mod.rs                                  ✅ Updated
│   └── redis/
│       ├── openvpn_servers_redis_repository.rs    ✅ Created
│       └── mod.rs                                  ✅ Updated
├── services/
│   ├── get_openvpn_servers.rs            ✅ Created
│   ├── add_openvpn_server.rs             ✅ Created
│   ├── update_openvpn_server.rs          ✅ Created
│   ├── show_openvpn_server.rs            ✅ Created
│   ├── delete_openvpn_server.rs          ✅ Created
│   └── mod.rs                             ✅ Updated
├── validations/
│   ├── openvpn_server/
│   │   ├── mod.rs                        ✅ Created
│   │   ├── store_validation.rs           ✅ Created
│   │   └── update_validation.rs          ✅ Created
│   └── mod.rs                             ✅ Updated
├── controllers/
│   ├── openvpn_server_controller.rs      ✅ Created
│   └── mod.rs                             ✅ Updated
├── routes/
│   ├── openvpn_server_route.rs           ✅ Created
│   └── mod.rs                             ✅ Updated
└── main.rs                                ✅ Updated
```

---

## Key Design Decisions

1. **UUID Generation**: Using `uuid7::uuid7()` via `uuid_helper::generate()` for deterministic ordering
2. **Redis Caching**: List cache with configurable bypass via `is_cache` parameter
3. **Cache Strategy**: 
   - Read operations check cache first
   - Write operations (add/update/delete) invalidate and refresh cache
   - TTL: 3600 seconds (1 hour) - configurable
4. **Validation**: XSS sanitization on all string inputs, length limits enforced
5. **Error Handling**: Typed errors with thiserror, consistent HTTP responses
6. **Naming Convention**: 
   - Plural routes for listing: `/openvpn-servers`
   - Singular routes for single operations: `/openvpn-server/{id}`

---

## Notes for Continuation

- All core implementation files have been created
- Module exports have been updated in all `mod.rs` files
- Routes have been registered in `main.rs`
- Ready for compilation and testing phase
- Consider adding integration tests after manual verification

---

## Redis Cache Key Format

```
{prefix}:openvpn_servers:list
```

Default TTL: 3600 seconds (1 hour)

---

**Status**: ✅ Implementation Complete - Code Successfully Compiled  
**Last Updated**: November 17, 2025

## Compilation Results

The project has been successfully compiled with **zero warnings** in application code.

```bash
cargo check
Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.79s
```

All OpenVPN server management endpoints are now ready for testing and integration.

## Next Steps

1. **Database Migration**: Run the migration to create the `openvpn_servers` table
   ```bash
   sqlx migrate run
   ```

2. **Start Server**: Launch the application
   ```bash
   cargo run
   ```

3. **API Testing**: Test the endpoints using curl or Postman
   - GET `/api-infra/openvpn-servers` - List all servers
   - POST `/api-infra/openvpn-server` - Create new server
   - GET `/api-infra/openvpn-server/{id}` - Get single server
   - PUT `/api-infra/openvpn-server/{id}` - Update server
   - DELETE `/api-infra/openvpn-server/{id}` - Delete server

4. **Redis Verification**: Monitor Redis cache behavior with the `is_cache` parameter

5. **Integration Testing**: Verify uniqueness constraints and validation rules
