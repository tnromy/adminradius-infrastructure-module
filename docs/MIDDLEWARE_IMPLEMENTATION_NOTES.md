# Middleware Implementation Notes

## Project Context Summary

### Existing Middleware Pattern
- `include_request_id_middleware.rs` - Uses Transform/Service pattern with `RequestIdMiddlewareService`
- `log_middleware.rs` - Uses same pattern with `LogMiddlewareService`
- Both use `Pin<Box<dyn Future<...>>>` for async operations

### File Naming Conventions
- Entities: `{name}_entity.rs` (snake_case)
- Infrastructures: `{name}.rs` (snake_case)
- Repositories: 
  - API: `{name}_api_repository.rs`
  - Redis: `{name}_redis_repository.rs`
  - PostgreSQL: `{name}_postgres_repository.rs`
- Services: `{action}_{entity}.rs` (e.g., `get_jwks.rs`, `validate_jwt.rs`)
- Middlewares: `{name}_middleware.rs`

### Route Pattern
Routes use `web::scope()` with `.route()` chains.
Example:
```rust
cfg.service(
    web::scope("/radius-client")
        .route("/vendors", web::get().to(controller::index_vendors)),
);
```

### Middleware Order (LIFO)
For Actix-web, `.wrap()` is LIFO - last wrapped executes first.
```rust
.wrap(AllowedBranchesMiddleware)  // Executes SECOND
.wrap(AuthenticationMiddleware)   // Executes FIRST
```

### Configuration Pattern
Config values accessed via `config.get_string("key.subkey")` or `config.get_int()`.

### App Data Pattern
Dependencies injected as:
```rust
.app_data(web::Data::new(service.clone()))
.app_data(web::Data::from(arc_config.clone()))  // For Arc<Config>
```

### HttpService Pattern
Currently: `HttpService::new(config, db, redis, s3, radius)`
Will add: `oauth2_issuer` parameter

---

## Files to Create

### 1. Entity Files
- `src/entities/role_entity.rs`
- `src/entities/access_token_payload_entity.rs`
- `src/entities/jwks_entity.rs`

### 2. Infrastructure Files
- `src/infrastructures/oauth2_issuer.rs`

### 3. Repository Files
- `src/repositories/api/oauth2_issuer_api_repository.rs`
- `src/repositories/redis/jwks_redis_repository.rs`

### 4. Service Files
- `src/services/get_jwks.rs`
- `src/services/validate_jwt.rs`

### 5. Middleware Files
- `src/middlewares/authentication_middleware.rs`
- `src/middlewares/allowed_branches_middleware.rs`

---

## Files to Modify

### mod.rs files to update:
- `src/entities/mod.rs` - Add 3 new modules
- `src/infrastructures/mod.rs` - Add oauth2_issuer
- `src/repositories/api/mod.rs` - Add oauth2_issuer_api_repository
- `src/repositories/redis/mod.rs` - Add jwks_redis_repository
- `src/services/mod.rs` - Add 2 new modules
- `src/middlewares/mod.rs` - Add 2 new modules

### Main application files:
- `src/main.rs` - Initialize oauth2_issuer
- `src/infrastructures/http_server.rs` - Add oauth2_issuer to HttpService and app_data

### Route files to add middleware:
- `src/routes/branch_topology_route.rs`
- `src/routes/device_connection_route.rs`
- `src/routes/device_port_interface_route.rs`
- `src/routes/device_port_route.rs`
- `src/routes/device_port_specification_route.rs`
- `src/routes/device_route.rs`
- `src/routes/device_type_route.rs`
- `src/routes/openvpn_client_route.rs`
- `src/routes/openvpn_server_route.rs`
- `src/routes/radius_client_route.rs`

### Config:
- `config/default.json` - Add oauth2 section

### OpenAPI files (add security to each operation):
- All `group_*.json` files in docs/openapi/

---

## OpenAPI Security Notes

The main file already has:
```json
"securitySchemes": {
  "bearerAuth": {
    "type": "http",
    "scheme": "bearer", 
    "bearerFormat": "JWT"
  }
},
"security": [
  { "bearerAuth": [] }
]
```

This applies security globally. Individual operations can override.

---

## Cargo Dependencies Already Present
- `actix-web = "4"`
- `jsonwebtoken = "9"` ✓
- `tokio = { version = "1", features = ["full"] }`
- `reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }` ✓
- `deadpool-redis = "0.15"`
- `config = "0.14"`
- `serde`, `serde_json` ✓
- `log`, `env_logger` ✓
- `anyhow`, `thiserror` ✓
- `futures = "0.3"` ✓

All required dependencies are already in Cargo.toml.

---

## Important: AllowedBranchesMiddleware Note

The documentation references `branch_postgres_repository::get_all()` but this repository doesn't exist yet. 

For this project (infrastructure module), branches are not stored locally - devices are associated with branch_ids that are external. The AllowedBranchesMiddleware should:
1. Extract branch_ids from JWT roles
2. If "any" is found, allow all operations (no filtering needed)
3. Otherwise, store the specific branch_ids for controller use

The middleware will NOT query a local branches table since it doesn't exist in this module.

---

Generated: December 25, 2025
