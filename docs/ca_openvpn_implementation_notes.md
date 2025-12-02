# OpenVPN CA API Implementation Notes

This document provides comprehensive notes for implementing the OpenVPN CA (Certificate Authority) API integration in the AdminRadius Infrastructure Module.

## Project Architecture Overview

### Directory Structure

```
src/
├── controllers/          # HTTP request handlers (routes call these)
├── entities/             # Data structures (DTOs) for API responses and DB rows
├── infrastructures/      # External service clients (HTTP, DB, Redis, S3, etc.)
├── middlewares/          # HTTP middleware (logging, request ID)
├── presentations/        # (Currently minimal)
├── repositories/
│   ├── api/              # External API repositories (use infrastructures clients)
│   ├── postgresql/       # Database repositories
│   ├── redis/            # Cache repositories
│   └── storage/          # S3/file storage repositories
├── routes/               # HTTP route definitions
├── services/             # Business logic (orchestrates repositories)
├── utils/                # Helper functions
└── validations/          # Request validation logic
```

### Key Patterns

#### 1. Infrastructures Layer (`src/infrastructures/`)

The infrastructures layer contains HTTP clients for external services. Each external service gets its own file.

**File naming:** `{service_name}.rs` (e.g., `radius.rs`, `ca_openvpn.rs`)

**Pattern from `radius.rs`:**

```rust
// Standard imports
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Context, Result};
use config::Config;
use reqwest::Client;
use serde::{Deserialize, Serialize};

// Generic API response structure (matches external API format)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct {ServiceName}ApiResponse<T> {
    pub status: {ServiceName}ApiStatus,
    pub request_id: String,
    pub data: T,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct {ServiceName}ApiStatus {
    pub code: u16,
    pub message: String,
}

// Service struct holds client and config
#[derive(Clone)]
pub struct {ServiceName}Service {
    client: Arc<Client>,
    base_api_endpoint: String,
    // Optional: access_token for Bearer auth
}

impl {ServiceName}Service {
    pub fn new(config: &Config) -> Result<Self> {
        // Read config values
        let base_api_endpoint = config
            .get_string("{config_key}.base_api_endpoint")
            .context("{config_key}.base_api_endpoint is not configured")?;

        // Build HTTP client with timeouts
        let client = Client::builder()
            .user_agent("adminradius-core-service")
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .build()
            .context("failed to build HTTP client")?;

        Ok(Self {
            client: Arc::new(client),
            base_api_endpoint,
        })
    }

    fn base_endpoint(&self) -> &str {
        self.base_api_endpoint.trim_end_matches('/')
    }

    // HTTP methods: get, post, put, delete
    // Each method:
    // 1. Constructs URL from base_endpoint + path
    // 2. Logs request
    // 3. Sends request
    // 4. Checks response status
    // 5. Parses JSON response
    // 6. Returns data field
}
```

**Registration in `mod.rs`:**
```rust
pub mod radius;
pub mod ca_openvpn;  // Add new module
```

#### 2. Entities Layer (`src/entities/`)

Entities are simple structs that represent data from external APIs or database rows.

**File naming:** `{entity_name}_entity.rs` (e.g., `radius_vendor_entity.rs`, `ca_openvpn_csr_client_entity.rs`)

**Pattern:**
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct {EntityName}Entity {
    pub field1: Type,
    pub field2: Option<Type>,
    // Fields match JSON structure from API response "data" property
}
```

**Registration in `mod.rs`:**
```rust
pub mod radius_vendor_entity;
pub mod ca_openvpn_csr_client_entity;  // Add new module
```

#### 3. API Repository Layer (`src/repositories/api/`)

API repositories contain functions that call external APIs using infrastructure clients.

**File naming:** `{service_name}_api_repository.rs` (e.g., `radius_api_repository.rs`, `ca_openvpn_api_repository.rs`)

**Pattern:**
```rust
use anyhow::Result;
use tokio::time::Instant;

use crate::entities::{entity_name}::{EntityName};
use crate::infrastructures::{service_name}::{ServiceName}Service;

/// Function documentation
pub async fn function_name(
    service: &{ServiceName}Service,
    param1: Type,
) -> Result<ReturnEntity> {
    log::debug!("{service}_api:{function}:prepare param={}", param1);
    let start = Instant::now();

    // Call infrastructure client
    match service.post::<ReturnEntity, RequestBody>("/endpoint", &body).await {
        Ok(result) => {
            log::debug!(
                "{service}_api:{function}:ok elapsed_ms={}",
                start.elapsed().as_millis()
            );
            Ok(result)
        }
        Err(e) => {
            log::error!(
                "{service}_api:{function}:err err={} elapsed_ms={}",
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}
```

**Registration in `mod.rs`:**
```rust
pub mod radius_api_repository;
pub mod ca_openvpn_api_repository;  // Add new module
```

#### 4. Services Layer (`src/services/`)

Services orchestrate business logic, calling repositories and applying caching.

**Pattern:** Services receive infrastructure clients as parameters, call repository functions, and optionally cache results.

---

## OpenVPN CA Implementation Specifics

### Config Structure (`config/default.json`)

```json
{
  "ca_openvpn": {
    "base_api_endpoint": "http://10.77.78.1:3001/racenet-openvpn",
    "access_token": "your-bearer-token-here"
  }
}
```

**Config keys:**
- `ca_openvpn.base_api_endpoint` - Base URL for CA API (no trailing slash)
- `ca_openvpn.access_token` - Bearer token for Authorization header

### Infrastructure Client (`src/infrastructures/ca_openvpn.rs`)

**Key differences from `radius.rs`:**
1. Stores `access_token` field
2. All HTTP methods include `Authorization: Bearer {token}` header

### Entities to Create

#### 1. `ca_openvpn_csr_client_entity.rs`
Response for client certificate request:
```rust
pub struct CaOpenvpnCsrClientEntity {
    pub certificate_request_id: String,
    pub message: String,
    pub requested_at: String,
    pub reserved_ip_address: String,
}
```

#### 2. `ca_openvpn_csr_server_entity.rs`
Response for server certificate request:
```rust
pub struct CaOpenvpnCsrServerEntity {
    pub certificate_request_id: String,
    pub message: String,
    pub requested_at: String,
    // Note: No reserved_ip_address field
}
```

#### 3. `ca_openvpn_approved_certificate_entity.rs`
Response for certificate approval:
```rust
pub struct CaOpenvpnApprovedCertificateEntity {
    pub certificate_pem: String,
    pub expired_at: String,
    pub issued_at: String,
    pub message: String,
    pub serial_number: i64,
}
```

### API Repository Functions

#### 1. `create_csr_client(passphrase: &str, cn: Option<&str>)`
- **Endpoint:** `POST /certificate/req`
- **Body:**
  ```json
  {
    "certificate_type": "client",
    "subject": { "CN": null | "string" },
    "passphrase": "string"
  }
  ```
- **Returns:** `CaOpenvpnCsrClientEntity`

#### 2. `create_csr_server(passphrase: &str, cn: &str)`
- **Endpoint:** `POST /certificate/req`
- **Body:**
  ```json
  {
    "certificate_type": "server",
    "subject": { "CN": "string" },
    "passphrase": "string"
  }
  ```
- **Returns:** `CaOpenvpnCsrServerEntity`

#### 3. `approve_csr(certificate_request_id: &str)`
- **Endpoint:** `PUT /certificate/req/{certReqId}/approve`
- **Body:** None
- **Returns:** `CaOpenvpnApprovedCertificateEntity`

### Request Body Structures (Internal)

These are used internally in the repository for serialization:

```rust
#[derive(Serialize)]
struct CsrRequestBody {
    certificate_type: String,
    subject: CsrSubject,
    passphrase: String,
}

#[derive(Serialize)]
struct CsrSubject {
    #[serde(rename = "CN")]
    cn: Option<String>,
}
```

---

## File Checklist

### Files to Create

1. `config/default.json` - Add `ca_openvpn` section
2. `src/infrastructures/ca_openvpn.rs` - HTTP client with Bearer auth
3. `src/infrastructures/mod.rs` - Register `ca_openvpn` module
4. `src/entities/ca_openvpn_csr_client_entity.rs` - Client CSR response
5. `src/entities/ca_openvpn_csr_server_entity.rs` - Server CSR response
6. `src/entities/ca_openvpn_approved_certificate_entity.rs` - Approval response
7. `src/entities/mod.rs` - Register new entity modules
8. `src/repositories/api/ca_openvpn_api_repository.rs` - API functions
9. `src/repositories/api/mod.rs` - Register new repository module

---

## Logging Convention

```
{service}_api:{function}:prepare [params]
{service}_api:{function}:ok [result_info] elapsed_ms={ms}
{service}_api:{function}:err err={error} elapsed_ms={ms}
```

Example:
```
ca_openvpn_api:create_csr_client:prepare
ca_openvpn_api:create_csr_client:ok cert_req_id=abc elapsed_ms=150
ca_openvpn_api:approve_csr:err err=timeout elapsed_ms=5000
```

---

## Notes

- The infrastructure layer handles all HTTP concerns (auth headers, timeouts, error handling)
- Repository functions are thin wrappers that call infrastructure methods
- Entities match the `data` field structure from API responses exactly
- Use `Option<String>` for nullable JSON fields
- Config keys use dot notation: `ca_openvpn.base_api_endpoint`
