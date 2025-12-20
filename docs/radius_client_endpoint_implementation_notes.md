# Radius Client Endpoint Implementation Notes

## Overview
This document outlines the implementation plan for adding RADIUS client related endpoints.

## Current Task: GET /radius-client/vendors

### Objective
Create an endpoint to retrieve the list of RADIUS vendors from cache (Redis) or external RADIUS API.

---

## File Structure Analysis

### Routes Pattern
- Location: `src/routes/`
- Naming: `{resource}_route.rs` (e.g., `device_type_route.rs`)
- Module registration: `src/routes/mod.rs`
- Route configuration function: `pub fn configure(cfg: &mut ServiceConfig)`

### Controllers Pattern
- Location: `src/controllers/`
- Naming: `{resource}_controller.rs` (e.g., `device_type_controller.rs`)
- Module registration: `src/controllers/mod.rs`
- Common imports:
  - `actix_web::{HttpRequest, HttpResponse, web}`
  - `crate::middlewares::include_request_id_middleware`
  - `crate::middlewares::log_middleware`
  - `crate::utils::http_response_helper`

### Services Pattern
- Location: `src/services/`
- Already exists: `get_radius_vendors.rs`
- Function signature: `execute(radius_service, redis, key_prefix) -> Result<Vec<RadiusVendorEntity>>`

### OpenAPI Documentation Pattern
- Location: `docs/openapi/`
- Module files: `group_{resource}.json`
- Main file: `infrastructure_service_adminradius.json`
- Path reference format: `"$ref": "./group_{resource}.json#/paths/~1api-infra~1{path}"`

---

## Implementation Plan

### Task 1: Create Controller
File: `src/controllers/radius_client_controller.rs`
- Create `index_vendors` async function
- Inject: `HttpRequest`, `web::Data<RadiusService>`, `web::Data<RedisConnection>`, `web::Data<Config>`
- Call: `get_radius_vendors::execute()`
- Return: JSON response with vendor list

### Task 2: Register Controller in mod.rs
File: `src/controllers/mod.rs`
- Add: `pub mod radius_client_controller;`

### Task 3: Create Route
File: `src/routes/radius_client_route.rs`
- Path: `/radius-client/vendors` with GET method
- Handler: `controller::index_vendors`

### Task 4: Register Route in mod.rs
File: `src/routes/mod.rs`
- Add: `pub mod radius_client_route;`
- Add: `radius_client_route::configure(cfg);` in configure function

### Task 5: Create OpenAPI Documentation
File: `docs/openapi/group_radius_client.json`
- Define GET /api-infra/radius-client/vendors endpoint
- Define RadiusVendor schema (id: integer, name: string, version: string)

### Task 6: Register in Main OpenAPI File
File: `docs/openapi/infrastructure_service_adminradius.json`
- Add "Radius Client" tag
- Add path reference to group_radius_client.json

---

## Entity Reference

### RadiusVendorEntity
```rust
pub struct RadiusVendorEntity {
    pub id: i32,
    pub name: String,
    pub version: String,
}
```

---

## Config Reference
- Redis cache key prefix comes from config
- Cache TTL: 3600 seconds (1 hour) - defined in service

---

## Dependencies
- RadiusService: Already injected in http_server.rs
- RedisConnection: Already injected in http_server.rs
- Config: Already injected in http_server.rs
