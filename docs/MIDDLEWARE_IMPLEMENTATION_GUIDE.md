# Panduan Implementasi Authentication dan AllowedBranches Middleware

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Arsitektur dan Alur Kerja](#2-arsitektur-dan-alur-kerja)
3. [Struktur File yang Harus Dibuat](#3-struktur-file-yang-harus-dibuat)
4. [Konfigurasi (config/default.json)](#4-konfigurasi-configdefaultjson)
5. [Entity Files](#5-entity-files)
6. [Infrastructure Files](#6-infrastructure-files)
7. [Repository Files](#7-repository-files)
8. [Service Files](#8-service-files)
9. [Middleware Files](#9-middleware-files)
10. [Penggunaan di Route](#10-penggunaan-di-route)
11. [Penggunaan di Controller](#11-penggunaan-di-controller)
12. [Cargo Dependencies](#12-cargo-dependencies)
13. [Checklist Implementasi](#13-checklist-implementasi)

---

## 1. Gambaran Umum

Dokumen ini menjelaskan cara mengimplementasikan dua middleware untuk autentikasi JWT dan pembatasan akses berdasarkan branch:

### AuthenticationMiddleware
- **Fungsi**: Memvalidasi token JWT dari header `Authorization: Bearer <token>`
- **Validasi**: Signature, expiration, issuer, authorized party (azp)
- **Output**: Menyimpan `AuthPayload(AccessTokenPayloadEntity)` ke request context

### AllowedBranchesMiddleware
- **Fungsi**: Mengekstrak branch IDs yang diizinkan dari roles di JWT payload
- **Dependensi**: Harus digunakan SETELAH AuthenticationMiddleware
- **Output**: Menyimpan `AllowedBranches(Vec<String>)` ke request context

### Format JWT Payload yang Didukung

```json
{
  "iss": "https://issuer.domain.com",
  "jti": "uuid-token-id",
  "sub": "uuid-user-id",
  "scope": "openid email phone profile",
  "aud": ["https://api.domain.com/resource1"],
  "roles": {
    "client": [
      {
        "display_name": "Role Name",
        "level": 2,
        "name": "rolename:branch-uuid-or-any"
      }
    ],
    "system": []
  },
  "azp": "uuid-client-id",
  "exp": 1766569784,
  "iat": 1766567984
}
```

---

## 2. Arsitektur dan Alur Kerja

### Alur Request dengan Kedua Middleware

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              HTTP Request                                      │
│                 Authorization: Bearer <jwt_token>                             │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       AuthenticationMiddleware                                │
│  1. Ekstrak Bearer token dari header                                          │
│  2. Decode JWT header, ambil kid                                              │
│  3. Ambil JWKS dari cache Redis atau fetch dari OAuth2 issuer                │
│  4. Validasi signature dengan public key yang sesuai                          │
│  5. Validasi exp, iss, azp                                                    │
│  6. Simpan AuthPayload(AccessTokenPayloadEntity) ke request extensions        │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │ (jika valid)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      AllowedBranchesMiddleware                                │
│  1. Ambil AuthPayload dari request extensions                                 │
│  2. Parse roles.client array                                                  │
│  3. Untuk setiap role, split name dengan ":" → segment kedua = branch_id      │
│  4. Jika branch_id = "any" → ambil semua branch IDs dari database             │
│  5. Jika bukan "any" → kumpulkan branch_id ke HashSet                         │
│  6. Simpan AllowedBranches(Vec<String>) ke request extensions                 │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             Controller                                         │
│  1. Ambil AllowedBranches dari request menggunakan helper function            │
│  2. Teruskan ke service untuk filtering                                       │
│  3. Return response                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Catatan Penting: Urutan Middleware di Actix-web

Middleware di Actix-web dieksekusi dalam urutan **LIFO (Last In, First Out)**.
Artinya, `.wrap()` yang terakhir dipanggil akan dieksekusi **pertama**.

```rust
// Urutan pemanggilan wrap()
cfg.service(
    web::scope("/branches")
        .wrap(AllowedBranchesMiddleware)  // Dipanggil KEDUA
        .wrap(AuthenticationMiddleware)    // Dipanggil PERTAMA
        .route("", web::get().to(controller::index)),
);
```

---

## 3. Struktur File yang Harus Dibuat

```
src/
├── entities/
│   ├── mod.rs                              # [MODIFY] Tambahkan module baru
│   ├── access_token_payload_entity.rs      # [CREATE] JWT payload entity
│   ├── role_entity.rs                      # [CREATE] Role entity
│   └── jwks_entity.rs                      # [CREATE] JWKS entity
│
├── infrastructures/
│   ├── mod.rs                              # [MODIFY] Tambahkan oauth2_issuer
│   └── oauth2_issuer.rs                    # [CREATE] OAuth2 issuer HTTP client
│
├── repositories/
│   ├── api/
│   │   ├── mod.rs                          # [MODIFY] Tambahkan oauth2_issuer_api_repository
│   │   └── oauth2_issuer_api_repository.rs # [CREATE] JWKS API repository
│   │
│   └── redis/
│       ├── mod.rs                          # [MODIFY] Tambahkan jwks_redis_repository
│       └── jwks_redis_repository.rs        # [CREATE] JWKS cache repository
│
├── services/
│   ├── mod.rs                              # [MODIFY] Tambahkan services baru
│   ├── get_jwks.rs                         # [CREATE] Get JWKS service
│   └── validate_jwt.rs                     # [CREATE] Validate JWT service
│
├── middlewares/
│   ├── mod.rs                              # [MODIFY] Tambahkan middlewares baru
│   ├── authentication_middleware.rs        # [CREATE] Authentication middleware
│   └── allowed_branches_middleware.rs      # [CREATE] Allowed branches middleware
│
├── routes/
│   └── [route_files].rs                    # [MODIFY] Tambahkan middleware ke routes
│
├── controllers/
│   └── [controller_files].rs               # [MODIFY] Gunakan helper functions
│
└── main.rs                                 # [MODIFY] Inisialisasi oauth2_issuer

config/
└── default.json                            # [MODIFY] Tambahkan konfigurasi oauth2
```

---

## 4. Konfigurasi (config/default.json)

Tambahkan section `oauth2` ke file konfigurasi:

```json
{
  "oauth2": {
    "issuer": "https://your-oauth2-issuer.domain.com",
    "client_id": "your-client-uuid",
    "jwks_path": "/jwks",
    "jwks_cache_expires": 86400
  }
}
```

### Penjelasan Konfigurasi

| Key | Tipe | Deskripsi |
|-----|------|-----------|
| `oauth2.issuer` | string | URL base OAuth2 issuer (tanpa trailing slash) |
| `oauth2.client_id` | string | Client ID yang diharapkan di field `azp` JWT |
| `oauth2.jwks_path` | string | Path endpoint JWKS (default: `/jwks`) |
| `oauth2.jwks_cache_expires` | integer | TTL cache JWKS di Redis dalam detik (default: 86400 = 1 hari) |

---

## 5. Entity Files

### 5.1 File: `src/entities/role_entity.rs`

```rust
use serde::{Deserialize, Serialize};

/// Role entity representing a single role
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoleEntity {
    pub name: String,
    pub display_name: String,
    pub level: i32,
}
```

### 5.2 File: `src/entities/access_token_payload_entity.rs`

```rust
use serde::{Deserialize, Serialize};

use crate::entities::role_entity::RoleEntity;

/// Roles structure in access token payload
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessTokenRolesEntity {
    pub system: Vec<RoleEntity>,
    pub client: Vec<RoleEntity>,
}

/// Access token (JWT) payload entity
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessTokenPayloadEntity {
    /// Audience - array of resource server identifiers
    pub aud: Vec<String>,
    /// Roles assigned to the user
    pub roles: AccessTokenRolesEntity,
    /// OAuth2 scopes (space-separated string)
    pub scope: String,
    /// Subject - user ID
    pub sub: String,
    /// Authorized party - client_id
    pub azp: String,
    /// JWT ID - unique identifier for this token
    pub jti: String,
    /// Issuer - OAuth2 issuer URL
    pub iss: String,
    /// Expiration time (Unix timestamp)
    pub exp: i64,
    /// Issued at time (Unix timestamp)
    pub iat: i64,
}
```

### 5.3 File: `src/entities/jwks_entity.rs`

```rust
use serde::{Deserialize, Serialize};

/// Single JWK key entity
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwkKeyEntity {
    pub alg: String,
    pub e: String,
    pub kid: String,
    pub kty: String,
    pub n: String,
    #[serde(rename = "use")]
    pub key_use: String,
}

/// JWKS (JSON Web Key Set) entity containing multiple keys
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwksEntity {
    pub keys: Vec<JwkKeyEntity>,
}
```

### 5.4 Update: `src/entities/mod.rs`

Tambahkan module baru:

```rust
pub mod access_token_payload_entity;
pub mod jwks_entity;
pub mod role_entity;
// ... module lainnya
```

---

## 6. Infrastructure Files

### 6.1 File: `src/infrastructures/oauth2_issuer.rs`

```rust
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use config::Config;
use reqwest::Client;

#[derive(Clone)]
pub struct OAuth2IssuerService {
    client: Arc<Client>,
    issuer: String,
    jwks_path: String,
}

impl OAuth2IssuerService {
    pub fn new(config: &Config) -> Result<Self> {
        let issuer = config
            .get_string("oauth2.issuer")
            .context("oauth2.issuer is not configured")?;
        let jwks_path = config
            .get_string("oauth2.jwks_path")
            .unwrap_or_else(|_| "/jwks".to_string());

        let client = Client::builder()
            .user_agent("your-service-name")
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .context("failed to build HTTP client for OAuth2 issuer")?;

        Ok(Self {
            client: Arc::new(client),
            issuer,
            jwks_path,
        })
    }

    pub fn jwks_endpoint(&self) -> String {
        format!("{}{}", self.issuer, self.jwks_path)
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn issuer(&self) -> &str {
        &self.issuer
    }
}

/// Initialize OAuth2 issuer service from config
pub fn initialize_oauth2_issuer(config: &Config) -> Result<OAuth2IssuerService> {
    OAuth2IssuerService::new(config)
}
```

### 6.2 Update: `src/infrastructures/mod.rs`

```rust
pub mod database;
pub mod oauth2_issuer;  // [TAMBAHKAN]
pub mod redis;
// ... module lainnya
```

### 6.3 Update: `src/main.rs`

Tambahkan inisialisasi OAuth2 issuer:

```rust
use infrastructures::oauth2_issuer::initialize_oauth2_issuer;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // ... kode lainnya

    let oauth2_issuer = initialize_oauth2_issuer(config.as_ref())
        .expect("Failed to initialize OAuth2 issuer service");
    log::info!("oauth2 issuer initialized");

    // Teruskan oauth2_issuer ke HttpService
    let http = HttpService::new(config.clone(), db, redis, s3, oauth2_issuer);
    http.start().await
}
```

### 6.4 Update: `src/infrastructures/http_server.rs`

Pastikan oauth2_issuer di-inject ke App:

```rust
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;

pub struct HttpService {
    config: Arc<Config>,
    db_connection: DatabaseConnection,
    redis_connection: RedisConnection,
    s3_service: S3Service,
    oauth2_issuer: OAuth2IssuerService,  // [TAMBAHKAN]
}

impl HttpService {
    pub fn new(
        config: Arc<Config>,
        db_connection: DatabaseConnection,
        redis_connection: RedisConnection,
        s3_service: S3Service,
        oauth2_issuer: OAuth2IssuerService,  // [TAMBAHKAN]
    ) -> Self {
        Self {
            config,
            db_connection,
            redis_connection,
            s3_service,
            oauth2_issuer,
        }
    }

    pub async fn start(&self) -> std::io::Result<()> {
        // ...
        let oauth2_issuer = self.oauth2_issuer.clone();
        
        let mut server = HttpServer::new(move || {
            App::new()
                .app_data(web::Data::new(db_connection.clone()))
                .app_data(web::Data::new(redis_connection.clone()))
                .app_data(web::Data::new(s3_service.clone()))
                .app_data(web::Data::new(oauth2_issuer.clone()))  // [TAMBAHKAN]
                .app_data(web::Data::new(config_arc.clone()))
                // ... middleware dan routes
        });
        // ...
    }
}
```

---

## 7. Repository Files

### 7.1 File: `src/repositories/api/oauth2_issuer_api_repository.rs`

```rust
use anyhow::Result;
use tokio::time::Instant;

use crate::entities::jwks_entity::JwksEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;

/// Get JWKS from OAuth2 issuer
pub async fn get_jwks(oauth2_issuer: &OAuth2IssuerService) -> Result<JwksEntity> {
    log::debug!("oauth2_issuer_api:get_jwks:start");

    let start = Instant::now();
    let endpoint = oauth2_issuer.jwks_endpoint();

    let response = oauth2_issuer
        .client()
        .get(&endpoint)
        .send()
        .await?;

    let status = response.status();
    log::debug!(
        "oauth2_issuer_api:get_jwks:response status={} elapsed_ms={}",
        status,
        start.elapsed().as_millis()
    );

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("JWKS request failed: status={} body={}", status, body);
    }

    let jwks: JwksEntity = response.json().await?;

    log::debug!(
        "oauth2_issuer_api:get_jwks:ok keys_count={} elapsed_ms={}",
        jwks.keys.len(),
        start.elapsed().as_millis()
    );

    Ok(jwks)
}
```

### 7.2 Update: `src/repositories/api/mod.rs`

```rust
pub mod oauth2_issuer_api_repository;  // [TAMBAHKAN]
// ... module lainnya
```

### 7.3 File: `src/repositories/redis/jwks_redis_repository.rs`

```rust
use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::redis;
use tokio::time::Instant;

use crate::entities::jwks_entity::JwksEntity;

const KEY: &str = "jwks";

/// Store JWKS in Redis with TTL
pub async fn set<C: AsyncCommands>(
    conn: &mut C,
    jwks: &JwksEntity,
    expire_seconds: i64,
) -> Result<(), redis::RedisError> {
    log::debug!("redis:jwks:set key={} ttl={}", KEY, expire_seconds);

    let start = Instant::now();
    let jwks_json = serde_json::to_string(jwks).unwrap_or_default();

    let res: Result<(), redis::RedisError> = conn
        .set_ex(KEY, &jwks_json, expire_seconds as u64)
        .await;

    match res {
        Ok(_) => {
            log::debug!(
                "redis:jwks:set:ok key={} elapsed_ms={}",
                KEY,
                start.elapsed().as_millis()
            );
            Ok(())
        }
        Err(e) => {
            log::error!(
                "redis:jwks:set:err key={} err={} elapsed_ms={}",
                KEY,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get JWKS from Redis
/// Returns Some(JwksEntity) if found, None if not found
pub async fn get<C: AsyncCommands>(
    conn: &mut C,
) -> Result<Option<JwksEntity>, redis::RedisError> {
    log::debug!("redis:jwks:get key={}", KEY);

    let start = Instant::now();
    let res: Result<Option<String>, _> = conn.get(KEY).await;

    match res {
        Ok(val) => {
            log::debug!(
                "redis:jwks:get:ok key={} hit={} elapsed_ms={}",
                KEY,
                val.is_some(),
                start.elapsed().as_millis()
            );
            match val {
                Some(json_str) => {
                    let jwks: JwksEntity = serde_json::from_str(&json_str)
                        .map_err(|e| {
                            redis::RedisError::from((
                                redis::ErrorKind::TypeError,
                                "failed to parse jwks json",
                                e.to_string(),
                            ))
                        })?;
                    Ok(Some(jwks))
                }
                None => Ok(None),
            }
        }
        Err(e) => {
            log::error!(
                "redis:jwks:get:err key={} err={} elapsed_ms={}",
                KEY,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}
```

### 7.4 Update: `src/repositories/redis/mod.rs`

```rust
pub mod jwks_redis_repository;  // [TAMBAHKAN]
// ... module lainnya
```

---

## 8. Service Files

### 8.1 File: `src/services/get_jwks.rs`

```rust
use config::Config;
use deadpool_redis::Pool;
use std::sync::Arc;

use crate::entities::jwks_entity::JwksEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;
use crate::repositories::api::oauth2_issuer_api_repository;
use crate::repositories::redis::jwks_redis_repository;

/// Default JWKS cache expires in seconds (1 day)
const DEFAULT_JWKS_CACHE_EXPIRES: i64 = 86400;

/// Get JWKS from Redis cache or fetch from OAuth2 issuer
pub async fn execute(
    redis_pool: &Arc<Pool>,
    oauth2_issuer: &OAuth2IssuerService,
    config: &Arc<Config>,
) -> Result<JwksEntity, String> {
    log::debug!("service:get_jwks:execute:start");

    let mut conn = redis_pool
        .get()
        .await
        .map_err(|e| format!("redis pool get error: {}", e))?;

    // 1. Try to get JWKS from Redis cache
    match jwks_redis_repository::get(&mut conn).await {
        Ok(Some(jwks)) => {
            log::debug!("service:get_jwks:execute:cache_hit");
            return Ok(jwks);
        }
        Ok(None) => {
            log::debug!("service:get_jwks:execute:cache_miss");
        }
        Err(e) => {
            log::warn!("service:get_jwks:execute:cache_error err={}", e);
            // Continue to fetch from API even if cache read fails
        }
    }

    // 2. Fetch JWKS from OAuth2 issuer API
    let jwks = oauth2_issuer_api_repository::get_jwks(oauth2_issuer)
        .await
        .map_err(|e| format!("get_jwks failed: {}", e))?;

    log::debug!(
        "service:get_jwks:execute:fetched_from_api keys_count={}",
        jwks.keys.len()
    );

    // 3. Store JWKS in Redis cache
    let cache_expires = config
        .get_int("oauth2.jwks_cache_expires")
        .unwrap_or(DEFAULT_JWKS_CACHE_EXPIRES);

    if let Err(e) = jwks_redis_repository::set(&mut conn, &jwks, cache_expires).await {
        log::warn!("service:get_jwks:execute:cache_store_error err={}", e);
        // Continue even if cache store fails
    } else {
        log::debug!("service:get_jwks:execute:cached ttl={}", cache_expires);
    }

    Ok(jwks)
}
```

### 8.2 File: `src/services/validate_jwt.rs`

```rust
use config::Config;
use deadpool_redis::Pool;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use std::sync::Arc;

use crate::entities::access_token_payload_entity::AccessTokenPayloadEntity;
use crate::entities::jwks_entity::JwksEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;
use crate::services::get_jwks;

/// JWT validation error types
#[derive(Debug)]
pub enum JwtValidationError {
    /// JWT format is invalid
    InvalidFormat(String),
    /// JWT signature verification failed
    InvalidSignature(String),
    /// JWT has expired
    Expired,
    /// JWT issuer doesn't match expected issuer
    InvalidIssuer { expected: String, actual: String },
    /// JWT authorized party (azp) doesn't match expected client_id
    InvalidAuthorizedParty { expected: String, actual: String },
    /// JWKS fetch failed
    JwksFetchError(String),
    /// Key ID not found in JWKS
    KeyNotFound(String),
    /// Internal error
    InternalError(String),
}

impl std::fmt::Display for JwtValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JwtValidationError::InvalidFormat(msg) => {
                write!(f, "invalid JWT format: {}", msg)
            }
            JwtValidationError::InvalidSignature(msg) => {
                write!(f, "invalid JWT signature: {}", msg)
            }
            JwtValidationError::Expired => write!(f, "JWT has expired"),
            JwtValidationError::InvalidIssuer { expected, actual } => {
                write!(f, "invalid issuer: expected '{}', got '{}'", expected, actual)
            }
            JwtValidationError::InvalidAuthorizedParty { expected, actual } => {
                write!(
                    f,
                    "invalid authorized party (azp): expected '{}', got '{}'",
                    expected, actual
                )
            }
            JwtValidationError::JwksFetchError(msg) => {
                write!(f, "JWKS fetch error: {}", msg)
            }
            JwtValidationError::KeyNotFound(kid) => {
                write!(f, "key not found in JWKS: kid={}", kid)
            }
            JwtValidationError::InternalError(msg) => {
                write!(f, "internal error: {}", msg)
            }
        }
    }
}

/// Validate JWT and return payload if valid
pub async fn execute(
    redis_pool: &Arc<Pool>,
    oauth2_issuer: &OAuth2IssuerService,
    config: &Arc<Config>,
    token: &str,
) -> Result<AccessTokenPayloadEntity, JwtValidationError> {
    log::debug!("service:validate_jwt:execute:start");

    // 1. Decode JWT header to get kid (key ID)
    let header = decode_header(token).map_err(|e| {
        log::error!("service:validate_jwt:execute:header_decode_error err={}", e);
        JwtValidationError::InvalidFormat(e.to_string())
    })?;

    let kid = header.kid.ok_or_else(|| {
        log::error!("service:validate_jwt:execute:no_kid_in_header");
        JwtValidationError::InvalidFormat("no kid in JWT header".to_string())
    })?;

    log::debug!("service:validate_jwt:execute:kid={}", kid);

    // 2. Get JWKS (from cache or API)
    let jwks = get_jwks::execute(redis_pool, oauth2_issuer, config)
        .await
        .map_err(JwtValidationError::JwksFetchError)?;

    // 3. Find the key with matching kid
    let jwk = find_key_by_kid(&jwks, &kid)?;

    // 4. Create decoding key from JWK
    let decoding_key = create_decoding_key(jwk)?;

    // 5. Get expected values from config
    let expected_issuer = config
        .get_string("oauth2.issuer")
        .map_err(|e| {
            JwtValidationError::InternalError(format!("config error: {}", e))
        })?;
    let expected_client_id = config
        .get_string("oauth2.client_id")
        .map_err(|e| {
            JwtValidationError::InternalError(format!("config error: {}", e))
        })?;

    // 6. Setup validation
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;
    validation.set_issuer(&[&expected_issuer]);
    // Disable aud validation, we validate azp instead
    validation.validate_aud = false;

    // 7. Decode and validate JWT
    let token_data = decode::<AccessTokenPayloadEntity>(
        token,
        &decoding_key,
        &validation,
    )
    .map_err(|e| {
        log::error!("service:validate_jwt:execute:decode_error err={}", e);
        match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                JwtValidationError::Expired
            }
            jsonwebtoken::errors::ErrorKind::InvalidIssuer => {
                JwtValidationError::InvalidIssuer {
                    expected: expected_issuer.clone(),
                    actual: "unknown".to_string(),
                }
            }
            jsonwebtoken::errors::ErrorKind::InvalidSignature => {
                JwtValidationError::InvalidSignature(e.to_string())
            }
            _ => JwtValidationError::InvalidFormat(e.to_string()),
        }
    })?;

    let payload = token_data.claims;

    // 8. Validate azp (authorized party) matches client_id
    if payload.azp != expected_client_id {
        log::error!(
            "service:validate_jwt:execute:invalid_azp expected={} actual={}",
            expected_client_id,
            payload.azp
        );
        return Err(JwtValidationError::InvalidAuthorizedParty {
            expected: expected_client_id,
            actual: payload.azp,
        });
    }

    // 9. Validate iss matches expected issuer
    if payload.iss != expected_issuer {
        log::error!(
            "service:validate_jwt:execute:invalid_iss expected={} actual={}",
            expected_issuer,
            payload.iss
        );
        return Err(JwtValidationError::InvalidIssuer {
            expected: expected_issuer,
            actual: payload.iss,
        });
    }

    log::debug!(
        "service:validate_jwt:execute:ok sub={} azp={} iss={}",
        payload.sub,
        payload.azp,
        payload.iss
    );

    Ok(payload)
}

/// Find JWK key by kid
fn find_key_by_kid<'a>(
    jwks: &'a JwksEntity,
    kid: &str,
) -> Result<&'a crate::entities::jwks_entity::JwkKeyEntity, JwtValidationError> {
    jwks.keys
        .iter()
        .find(|key| key.kid == kid)
        .ok_or_else(|| JwtValidationError::KeyNotFound(kid.to_string()))
}

/// Create DecodingKey from JWK (RSA)
fn create_decoding_key(
    jwk: &crate::entities::jwks_entity::JwkKeyEntity,
) -> Result<DecodingKey, JwtValidationError> {
    if jwk.kty != "RSA" {
        return Err(JwtValidationError::InvalidFormat(format!(
            "unsupported key type: {}",
            jwk.kty
        )));
    }

    DecodingKey::from_rsa_components(&jwk.n, &jwk.e).map_err(|e| {
        JwtValidationError::InvalidFormat(format!("failed to create decoding key: {}", e))
    })
}
```

### 8.3 Update: `src/services/mod.rs`

```rust
pub mod get_jwks;      // [TAMBAHKAN]
pub mod validate_jwt;  // [TAMBAHKAN]
// ... module lainnya
```

---

## 9. Middleware Files

### 9.1 File: `src/middlewares/authentication_middleware.rs`

```rust
use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, web,
};
use actix_web::body::BoxBody;
use config::Config;
use futures::future::{ok, Ready};
use futures::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::sync::Arc;
use std::task::{Context, Poll};

use crate::entities::access_token_payload_entity::AccessTokenPayloadEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;
use crate::infrastructures::redis::RedisConnection;
use crate::services::validate_jwt::{self, JwtValidationError};

/// Authentication middleware factory
pub struct AuthenticationMiddleware;

impl<S> Transform<S, ServiceRequest> for AuthenticationMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthenticationMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AuthenticationMiddlewareService {
            service: Rc::new(service),
        })
    }
}

pub struct AuthenticationMiddlewareService<S> {
    service: Rc<S>,
}

/// Wrapper for auth payload stored in request extensions
#[derive(Clone)]
pub struct AuthPayload(pub AccessTokenPayloadEntity);

impl<S> Service<ServiceRequest> for AuthenticationMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let srv = self.service.clone();

        // Extract dependencies from app data
        let redis_opt = req.app_data::<web::Data<RedisConnection>>().cloned();
        let oauth2_issuer_opt = req.app_data::<web::Data<OAuth2IssuerService>>().cloned();
        let config_opt = req.app_data::<web::Data<Arc<Config>>>().cloned();

        // Extract bearer token from Authorization header
        let auth_header = req
            .headers()
            .get(actix_web::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        let token = if auth_header.to_lowercase().starts_with("bearer ") {
            Some(auth_header[7..].trim().to_string())
        } else {
            None
        };

        Box::pin(async move {
            // Check if token is present
            let token = match token {
                Some(t) if !t.is_empty() => t,
                _ => {
                    log::warn!("authentication_middleware: missing or empty bearer token");
                    return Ok(req.into_response(
                        actix_web::HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": "missing or invalid authorization header"
                            }))
                    ));
                }
            };

            // Check required dependencies
            let (redis, oauth2_issuer, config) = match (redis_opt, oauth2_issuer_opt, config_opt) {
                (Some(r), Some(o), Some(c)) => (r, o, c),
                _ => {
                    log::error!("authentication_middleware: missing required dependencies");
                    return Ok(req.into_response(
                        actix_web::HttpResponse::InternalServerError()
                            .json(serde_json::json!({
                                "error": "internal configuration error"
                            }))
                    ));
                }
            };

            // Validate JWT
            match validate_jwt::execute(
                &redis.pool(),
                oauth2_issuer.get_ref(),
                &config,
                &token,
            )
            .await
            {
                Ok(payload) => {
                    log::debug!(
                        "authentication_middleware: validated sub={} azp={}",
                        payload.sub,
                        payload.azp
                    );

                    // Store payload in request extensions
                    req.extensions_mut().insert(AuthPayload(payload));

                    // Continue to next service
                    let res = srv.call(req).await?;
                    Ok(res)
                }
                Err(e) => {
                    let error_message = match &e {
                        JwtValidationError::Expired => "token has expired",
                        JwtValidationError::InvalidSignature(_) => "invalid token signature",
                        JwtValidationError::InvalidIssuer { .. } => "invalid token issuer",
                        JwtValidationError::InvalidAuthorizedParty { .. } => {
                            "token not authorized for this client"
                        }
                        JwtValidationError::InvalidFormat(_) => "invalid token format",
                        JwtValidationError::KeyNotFound(_) => "signing key not found",
                        _ => "token validation failed",
                    };

                    log::warn!("authentication_middleware: validation failed err={}", e);
                    Ok(req.into_response(
                        actix_web::HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": error_message
                            }))
                    ))
                }
            }
        })
    }
}

/// Helper function to extract auth payload from HttpRequest
#[allow(dead_code)]
pub fn extract_auth_payload(
    req: &actix_web::HttpRequest,
) -> Option<AccessTokenPayloadEntity> {
    req.extensions().get::<AuthPayload>().map(|p| p.0.clone())
}

/// Helper function to extract user sub (user_id) from HttpRequest
#[allow(dead_code)]
pub fn extract_auth_sub(req: &actix_web::HttpRequest) -> Option<String> {
    extract_auth_payload(req).map(|p| p.sub)
}
```

### 9.2 File: `src/middlewares/allowed_branches_middleware.rs`

```rust
use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, web,
};
use actix_web::body::BoxBody;
use futures::future::{ok, Ready};
use futures::Future;
use std::collections::HashSet;
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll};

use crate::entities::access_token_payload_entity::AccessTokenPayloadEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::middlewares::authentication_middleware::AuthPayload;
use crate::repositories::postgresql::branch_postgres_repository;

/// AllowedBranches middleware factory
/// 
/// This middleware extracts allowed branch IDs from JWT roles and stores them
/// in request extensions. It must be used AFTER AuthenticationMiddleware.
/// 
/// Role name format: "<role_type>:<branch_id>"
/// - If branch_id is "any", user has access to ALL branches
/// - Otherwise, branch_id is a specific UUID
pub struct AllowedBranchesMiddleware;

impl<S> Transform<S, ServiceRequest> for AllowedBranchesMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type InitError = ();
    type Transform = AllowedBranchesMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AllowedBranchesMiddlewareService {
            service: Rc::new(service),
        })
    }
}

pub struct AllowedBranchesMiddlewareService<S> {
    service: Rc<S>,
}

/// Wrapper for allowed branches stored in request extensions
#[derive(Clone)]
pub struct AllowedBranches(pub Vec<String>);

impl<S> Service<ServiceRequest> for AllowedBranchesMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let srv = self.service.clone();

        // Extract dependencies from app data
        let db_opt = req.app_data::<web::Data<DatabaseConnection>>().cloned();

        // Extract auth payload from request extensions (set by AuthenticationMiddleware)
        let auth_payload_opt = req.extensions().get::<AuthPayload>().cloned();

        Box::pin(async move {
            // Check if auth payload is present
            let auth_payload = match auth_payload_opt {
                Some(AuthPayload(payload)) => payload,
                None => {
                    log::warn!("allowed_branches_middleware: auth payload not found in request extensions");
                    return Ok(req.into_response(
                        actix_web::HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": "authentication required"
                            }))
                    ));
                }
            };

            // Check if database connection is available
            let db = match db_opt {
                Some(d) => d,
                None => {
                    log::error!("allowed_branches_middleware: database connection not found");
                    return Ok(req.into_response(
                        actix_web::HttpResponse::InternalServerError()
                            .json(serde_json::json!({
                                "error": "internal configuration error"
                            }))
                    ));
                }
            };

            // Extract allowed branches from roles
            let allowed_branches = match extract_allowed_branch_ids(&auth_payload, &db).await {
                Ok(branches) => branches,
                Err(e) => {
                    log::error!("allowed_branches_middleware: failed to extract allowed branches: {}", e);
                    return Ok(req.into_response(
                        actix_web::HttpResponse::InternalServerError()
                            .json(serde_json::json!({
                                "error": "failed to determine allowed branches"
                            }))
                    ));
                }
            };

            log::debug!(
                "allowed_branches_middleware: sub={} allowed_branches_count={}",
                auth_payload.sub,
                allowed_branches.len()
            );

            // Store allowed branches in request extensions
            req.extensions_mut().insert(AllowedBranches(allowed_branches));

            // Continue to next service
            let res = srv.call(req).await?;
            Ok(res)
        })
    }
}

/// Extract allowed branch IDs from JWT roles
/// 
/// Parses the client roles and extracts branch_id from each role's name.
/// Role name format: "<role_type>:<branch_id>"
/// 
/// If any role has branch_id "any", returns all branch IDs from database.
async fn extract_allowed_branch_ids(
    payload: &AccessTokenPayloadEntity,
    db: &DatabaseConnection,
) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
    let mut allowed_branches: HashSet<String> = HashSet::new();
    let mut has_any_access = false;

    // Process client roles
    for role in &payload.roles.client {
        // Split role name by ":" to get branch_id
        let parts: Vec<&str> = role.name.split(':').collect();
        
        if parts.len() >= 2 {
            let branch_id = parts[1];
            
            if branch_id == "any" {
                has_any_access = true;
                break; // No need to check other roles
            } else {
                allowed_branches.insert(branch_id.to_string());
            }
        }
    }

    // If user has "any" access, fetch all branch IDs from database
    if has_any_access {
        let pool = db.get_pool();
        let conn = pool.as_ref();
        
        let all_branches = branch_postgres_repository::get_all(conn).await?;
        let all_ids: Vec<String> = all_branches.into_iter().map(|b| b.id).collect();
        
        log::debug!(
            "allowed_branches_middleware: user has 'any' access, loaded {} branches",
            all_ids.len()
        );
        
        return Ok(all_ids);
    }

    // Convert HashSet to Vec for storage
    let result: Vec<String> = allowed_branches.into_iter().collect();
    
    log::debug!(
        "allowed_branches_middleware: user has specific access to {} branches",
        result.len()
    );

    Ok(result)
}

/// Helper function to extract allowed branches from HttpRequest
#[allow(dead_code)]
pub fn extract_allowed_branches(req: &actix_web::HttpRequest) -> Option<Vec<String>> {
    req.extensions()
        .get::<AllowedBranches>()
        .map(|ab| ab.0.clone())
}

/// Helper function to check if a branch ID is allowed
#[allow(dead_code)]
pub fn is_branch_allowed(req: &actix_web::HttpRequest, branch_id: &str) -> bool {
    match req.extensions().get::<AllowedBranches>() {
        Some(AllowedBranches(branches)) => branches.contains(&branch_id.to_string()),
        None => false,
    }
}
```

### 9.3 Update: `src/middlewares/mod.rs`

```rust
pub mod allowed_branches_middleware;   // [TAMBAHKAN]
pub mod authentication_middleware;     // [TAMBAHKAN]
pub mod include_request_id_middleware;
pub mod log_middleware;
```

---

## 10. Penggunaan di Route

### 10.1 Hanya AuthenticationMiddleware

Untuk endpoint yang hanya membutuhkan validasi JWT tanpa filtering branch:

```rust
use actix_web::web::{self, ServiceConfig};

use crate::controllers::example_controller as controller;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/examples")
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index))
            .route("", web::post().to(controller::store)),
    );

    cfg.service(
        web::scope("/example")
            .wrap(AuthenticationMiddleware)
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::put().to(controller::update))
            .route("/{id}", web::delete().to(controller::destroy)),
    );
}
```

### 10.2 AuthenticationMiddleware + AllowedBranchesMiddleware

Untuk endpoint yang membutuhkan filtering berdasarkan branch:

```rust
use actix_web::web::{self, ServiceConfig};

use crate::controllers::branch_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    // PENTING: Urutan middleware adalah LIFO (Last In, First Out)
    // .wrap() yang terakhir dipanggil akan dieksekusi PERTAMA
    
    cfg.service(
        web::scope("/branches")
            .wrap(AllowedBranchesMiddleware)  // Dieksekusi KEDUA
            .wrap(AuthenticationMiddleware)    // Dieksekusi PERTAMA
            .route("", web::get().to(controller::index)),
    );
}
```

### 10.3 Mixed: Beberapa Endpoint dengan Middleware Berbeda

```rust
use actix_web::web::{self, ServiceConfig};

use crate::controllers::branch_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    // List endpoint DENGAN filtering branch
    cfg.service(
        web::scope("/branches")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index)),
    );

    // CRUD endpoints TANPA filtering branch (hanya auth)
    cfg.service(
        web::scope("/branch")
            .wrap(AuthenticationMiddleware)
            .route("", web::post().to(controller::store))
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::put().to(controller::update))
            .route("/{id}", web::delete().to(controller::destroy)),
    );
}
```

### 10.4 Endpoint Tanpa Authentication (Public)

```rust
pub fn configure(cfg: &mut ServiceConfig) {
    // Public endpoint - tidak ada middleware
    cfg.service(
        web::resource("/health")
            .route(web::get().to(controller::health_check)),
    );
}
```

---

## 11. Penggunaan di Controller

### 11.1 Mengambil Auth Payload

```rust
use actix_web::{HttpRequest, HttpResponse};
use crate::middlewares::authentication_middleware::{extract_auth_payload, extract_auth_sub};

pub async fn example(req: HttpRequest) -> HttpResponse {
    // Cara 1: Ambil seluruh payload
    if let Some(payload) = extract_auth_payload(&req) {
        println!("User ID: {}", payload.sub);
        println!("Client ID: {}", payload.azp);
        println!("Issuer: {}", payload.iss);
        println!("Roles: {:?}", payload.roles.client);
    }

    // Cara 2: Ambil hanya user_id (sub)
    if let Some(user_id) = extract_auth_sub(&req) {
        println!("User ID: {}", user_id);
    }

    HttpResponse::Ok().finish()
}
```

### 11.2 Mengambil Allowed Branches

```rust
use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::json;
use crate::middlewares::allowed_branches_middleware::{extract_allowed_branches, is_branch_allowed};
use crate::utils::http_response_helper;

pub async fn index(
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
    req: HttpRequest,
) -> HttpResponse {
    // Cara 1: Ambil list allowed branches
    let allowed_branches = extract_allowed_branches(&req);
    
    // Teruskan ke service
    match get_entities::execute(&db, &redis, "key", allowed_branches.as_deref()).await {
        Ok(entities) => http_response_helper::ok(json!({
            "data": entities
        })),
        Err(e) => {
            eprintln!("Database error: {:?}", e);
            http_response_helper::internal_server_error(json!({
                "error": "Failed to fetch data"
            }))
        }
    }
}

pub async fn show(
    db: web::Data<DatabaseConnection>,
    req: HttpRequest,
    id: web::Path<String>,
) -> HttpResponse {
    // Cara 2: Cek apakah branch tertentu diizinkan
    let branch_id = "some-branch-uuid";
    if !is_branch_allowed(&req, branch_id) {
        return http_response_helper::forbidden(json!({
            "error": "Access to this branch is not allowed"
        }));
    }

    // ... lanjutkan proses
    HttpResponse::Ok().finish()
}
```

### 11.3 Contoh Controller Lengkap dengan Filtering

```rust
use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::middlewares::allowed_branches_middleware::extract_allowed_branches;
use crate::services::get_branches;
use crate::utils::http_response_helper;

const CACHE_KEY_PREFIX: &str = "branch";

pub async fn index(
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
    req: HttpRequest,
) -> HttpResponse {
    // Extract allowed branches dari request context
    // yang telah di-set oleh AllowedBranchesMiddleware
    let allowed_branches = extract_allowed_branches(&req);
    
    // Teruskan ke service dengan optional filtering
    // Jika allowed_branches adalah None, service akan return semua data
    // Jika allowed_branches adalah Some([...]), service akan filter berdasarkan list
    match get_branches::execute(
        &db, 
        &redis, 
        CACHE_KEY_PREFIX, 
        allowed_branches.as_deref()
    ).await {
        Ok(entities) => http_response_helper::ok(json!({
            "data": entities
        })),
        Err(e) => {
            eprintln!("Database error: {:?}", e);
            http_response_helper::internal_server_error(json!({
                "error": "Failed to fetch branches"
            }))
        }
    }
}
```

---

## 12. Cargo Dependencies

Tambahkan dependencies berikut ke `Cargo.toml`:

```toml
[dependencies]
# Web framework
actix-web = "4"

# JWT handling
jsonwebtoken = "9"

# Async runtime
tokio = { version = "1", features = ["full"] }
futures = "0.3"

# HTTP client untuk JWKS
reqwest = { version = "0.11", features = ["json", "rustls-tls"], default-features = false }

# Redis
deadpool-redis = "0.13"

# Configuration
config = "0.13"

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Logging
log = "0.4"
env_logger = "0.10"

# Error handling
anyhow = "1"
thiserror = "1"
```

---

## 13. Checklist Implementasi

Gunakan checklist berikut untuk memastikan semua file telah dibuat dan dikonfigurasi:

### Entity Files
- [ ] `src/entities/role_entity.rs` - Buat file baru
- [ ] `src/entities/access_token_payload_entity.rs` - Buat file baru
- [ ] `src/entities/jwks_entity.rs` - Buat file baru
- [ ] `src/entities/mod.rs` - Tambahkan 3 module baru

### Infrastructure Files
- [ ] `src/infrastructures/oauth2_issuer.rs` - Buat file baru
- [ ] `src/infrastructures/mod.rs` - Tambahkan oauth2_issuer module

### Repository Files
- [ ] `src/repositories/api/oauth2_issuer_api_repository.rs` - Buat file baru
- [ ] `src/repositories/api/mod.rs` - Tambahkan module baru
- [ ] `src/repositories/redis/jwks_redis_repository.rs` - Buat file baru
- [ ] `src/repositories/redis/mod.rs` - Tambahkan module baru

### Service Files
- [ ] `src/services/get_jwks.rs` - Buat file baru
- [ ] `src/services/validate_jwt.rs` - Buat file baru
- [ ] `src/services/mod.rs` - Tambahkan 2 module baru

### Middleware Files
- [ ] `src/middlewares/authentication_middleware.rs` - Buat file baru
- [ ] `src/middlewares/allowed_branches_middleware.rs` - Buat file baru
- [ ] `src/middlewares/mod.rs` - Tambahkan 2 module baru

### Configuration
- [ ] `config/default.json` - Tambahkan section oauth2

### Main Application
- [ ] `src/main.rs` - Inisialisasi oauth2_issuer
- [ ] `src/infrastructures/http_server.rs` - Inject oauth2_issuer ke App

### Route dan Controller
- [ ] Route files - Tambahkan .wrap() middleware
- [ ] Controller files - Gunakan helper functions untuk mengambil context

### Dependencies
- [ ] `Cargo.toml` - Tambahkan dependencies yang diperlukan

---

## Catatan Tambahan

### Log Format

Middleware menggunakan format log yang konsisten:
```
<component>: <action> <key>=<value> ...
```

Contoh:
```
authentication_middleware: validated sub=user-uuid azp=client-uuid
allowed_branches_middleware: sub=user-uuid allowed_branches_count=3
```

### Error Response Format

Semua error response menggunakan format JSON yang konsisten:
```json
{
  "error": "error message"
}
```

### Keamanan

1. Token JWT divalidasi signature-nya menggunakan public key dari JWKS
2. JWKS di-cache di Redis untuk mengurangi request ke OAuth2 issuer
3. Validasi meliputi: exp (expiration), iss (issuer), azp (authorized party)
4. Token yang expired akan ditolak dengan pesan yang jelas

### Performance

1. JWKS di-cache selama `jwks_cache_expires` detik (default 1 hari)
2. Untuk filtered queries, caching di-skip untuk konsistensi data
3. Jika user memiliki akses "any", semua branch IDs di-fetch sekali saja

---

**Dokumen ini dibuat pada**: December 24, 2025  
**Versi**: 1.0  
**Project Reference**: adminradius-core-api
