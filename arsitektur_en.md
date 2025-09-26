# AI Agent Prompt: Rust Project Architecture for Network Device Management

## 1. Project Overview

You are tasked with developing a backend service using Rust. This service is intended for managing computer network devices within an Internet Service Provider (ISP) company.

**Core Technology Stack:**
- **Programming Language:** Rust
- **Web Framework:** Actix Web
- **Primary Database:** PostgreSQL (using `sqlx`)
- **Caching Layer:** Redis (using `deadpool-redis` for connection pooling)
- **Activity Logging:** Elasticsearch
- **File Storage:** S3-compatible object storage (e.g., MinIO)

The project architecture is designed to be modular, scalable, and maintainable, following clean architecture principles. Your primary goal is to understand this architecture in detail to implement new features consistently.

## 2. Current Project Status

The project is in its initial phase. Here's what has been done:
- The project directory has been initialized using `cargo init .`.
- Database migrations have been created in the `migrations/` folder.
- The database schema has been successfully applied to the PostgreSQL database using the `sqlx migrate run` command. The database now contains all the tables defined in the migration files.
- The directory structure within `src/` has been laid out, but most files are empty and need to be implemented.

**Current Directory Structure:**
```
.
├── Cargo.toml
├── config/
│   └── default.json
├── migrations/
│   ├── 20250923032049_create_device_port_specifications_table.down.sql
│   ├── 20250923032049_create_device_port_specifications_table.up.sql
│   ├── 20250923032050_create_device_port_interfaces_table.down.sql
│   ├── 20250923032050_create_device_port_interfaces_table.up.sql
│   ├── 20250923032051_create_device_types_table.down.sql
│   ├── 20250923032051_create_device_types_table.up.sql
│   ├── 20250923032100_create_devices_table.down.sql
│   ├── 20250923032100_create_devices_table.up.sql
│   ├── 20250923032110_create_device_ports_table.down.sql
│   ├── 20250923032110_create_device_ports_table.up.sql
│   ├── 20250923032120_create_device_connections_table.down.sql
│   └── 20250923032120_create_device_connections_table.up.sql
└── src/
    ├── main.rs
    ├── controllers/
    ├── entities/
    ├── infrastructures/
    │   ├── database.rs
    │   ├── elastic_search.rs
    │   ├── http_server.rs
    │   ├── redis.rs
    │   └── s3.rs
    ├── middlewares/
    │   ├── include_request_id_middleware.rs
    │   ├── log_middleware.rs
    │   └── mod.rs
    ├── repositories/
    │   ├── postgresql/
    │   ├── redis/
    │   └── storage/
    ├── routes/
    ├── services/
    └── utils/
        ├── http_response_helper.rs
        ├── mod.rs
        ├── sql_security_helper.rs
        ├── string_helper.rs
        ├── uuid_helper.rs
        └── xss_security_helper.rs
    └── validations/
```

## 3. Configuration Management

The `config/` directory contains a `default.json` file. This is used by the `config` crate to manage application settings. This approach allows configuration to be modified even after the project is compiled. All credentials and service endpoints (Database, Redis, S3, etc.) should be read from this file.

## 4. Detailed Architecture (`src/` directory)

### 4.1. `main.rs` - The Entry Point

The `main.rs` file is the primary entry point of the application. It is responsible for:
- Initializing all modules.
- Loading the configuration.
- Initializing infrastructure services (Database, Redis, S3).
- Starting the Actix web server.

**Reference Implementation for `main.rs`:**
```rust
mod infrastructures;
mod routes;
mod controllers;
mod middlewares;
mod utils;
mod entities;
mod repositories;
mod services;
mod validations;
mod presentations;

use infrastructures::http_server::{HttpService, load_config};
use infrastructures::database::initialize_database;
use infrastructures::redis::initialize_redis;
use infrastructures::s3::initialize_s3;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Init logger with fallback filters
    if std::env::var("RUST_LOG").is_ok() {
        env_logger::init();
    } else {
        let mut builder = env_logger::Builder::new();
        builder.filter_level(log::LevelFilter::Info);
        builder.parse_default_env();
        builder.init();
    }
    log::info!("logger initialized");

    // Load configuration from config/default.json
    let config = load_config();
    log::info!("config loaded");

    // Initialize database connection pool
    let db = initialize_database(config.as_ref())
        .await
        .expect("Failed to initialize database connection");
    log::info!("database initialized");

    // Initialize redis connection manager
    let redis = initialize_redis(config.as_ref())
        .await
        .expect("Failed to initialize redis connection");
    log::info!("redis initialized");

    // Initialize S3 service (MinIO)
    let s3 = initialize_s3(config.as_ref())
        .await
        .expect("Failed to initialize S3 connection");
    log::info!("s3 initialized");

    // Start HTTP server
    let http = HttpService::new(config.clone(), db, redis, s3);
    log::info!("starting http server");
    http.start().await
}
```

### 4.2. `Cargo.toml` - Dependencies

To ensure consistency and use the correct libraries, refer to the following `Cargo.toml` from a similar project. This provides a good starting point for the crates needed for database pooling, web framework, serialization, etc.

**Reference `Cargo.toml`:**
```toml
[package]
name = "adminradius-infrastructure-service"
version = "1.0.0"
edition = "2024"
authors = ["Your Name"]

[dependencies]
actix-web = "4"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
config = { version = "0.14", features = ["json"] }
uuid = { version = "1", features = ["serde", "v4"] }
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "macros", "migrate", "chrono", "uuid"] }
deadpool-redis = "0.15"
deadpool = "0.12"
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
thiserror = "1"
log = "0.4"
env_logger = "0.11"
# S3/MinIO client
rust-s3 = { version = "0.35", default-features = false, features = ["tokio-rustls-tls"] }
# HTTP client for Elasticsearch
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
# Other helpers
bcrypt = "0.15"
sha2 = "0.10"
base64 = "0.22"
jsonwebtoken = "9"
futures = "0.3"
url = "2"
regex = "1"
```

### 4.3. `infrastructures/` Directory

This directory contains modules for connecting to all external services. The goal is to abstract away the connection logic, so other parts of the application can easily use these services.

**Crucial Rule: All settings for these infrastructures MUST be read from the `config/default.json` file.** You must pay close attention to the existing `default.json` and utilize its values. This includes credentials, endpoints, pool sizes, and server settings.

- **`database.rs`**: Manages the PostgreSQL connection pool (`PgPool`) using `sqlx`. All database credentials and pool settings must be sourced from the configuration file.
- **`redis.rs`**: Manages the Redis connection pool using `deadpool-redis`. Connection details and pool settings must be read from the configuration file.
- **`s3.rs`**: Manages the connection and bucket configuration for the S3 service. Credentials, endpoint, and bucket name must come from the configuration file.
- **`http_server.rs`**: Configures and runs the Actix web server. The host, IP address, and port it listens on must be configured via `config/default.json`.
- **`elastic_search.rs`**: Provides a client for sending logs to Elasticsearch. The endpoint and index prefix must be configured.
  - **Logging Strategy**: Logging to Elasticsearch follows a "one index per day" pattern. Each incoming HTTP request should be logged as a single document. The index name for a given day is constructed using the `index_prefix` from the configuration, followed by the date (e.g., `your-prefix-YYYY-MM-DD`).

**Reference Implementations:**
*Follow the patterns in the provided examples to implement these files. The key is to have an `initialize_*` function and a struct (e.g., `DatabaseConnection`) that holds the connection pool and can be cloned for sharing across threads.*

- **`http_server.rs` Example:**
  ```rust
  // In our project, this file is named http_server.rs
  use actix_web::{App, HttpServer as ActixHttpServer, web};
  use config::{Config, File};
  use std::sync::Arc;
  use crate::infrastructures::database::DatabaseConnection;
  use crate::infrastructures::redis::RedisConnection;
  use crate::infrastructures::s3::S3Service;
  use crate::infrastructures::elastic_search::ElasticSearchService;
  // ... import middlewares and routes

  pub struct HttpService {
      config: Arc<Config>,
      db_connection: DatabaseConnection,
      redis_connection: RedisConnection,
      s3_service: S3Service,
  }

  impl HttpService {
      pub fn new(config: Arc<Config>, db_connection: DatabaseConnection, redis_connection: RedisConnection, s3_service: S3Service) -> Self {
          Self { config, db_connection, redis_connection, s3_service }
      }

      pub async fn start(&self) -> std::io::Result<()> {
          let host = self.config.get_string("server.host").unwrap_or_else(|_| "127.0.0.1".to_string());
          let port = self.config.get_int("server.port").unwrap_or(8080) as u16;
          
          println!("Starting HTTP server on {}:{}", host, port);
          
          let db_connection = self.db_connection.clone();
          let redis_connection = self.redis_connection.clone();
          let s3_service = self.s3_service.clone();
          let config_arc = self.config.clone();
          let es_service = ElasticSearchService::new(config_arc.as_ref()).ok();

          ActixHttpServer::new(move || {
              App::new()
                  .app_data(web::Data::new(db_connection.clone()))
                  .app_data(web::Data::new(redis_connection.clone()))
                  .app_data(web::Data::new(s3_service.clone()))
                  .app_data(web::Data::new(config_arc.clone()))
                  .app_data(web::Data::new(es_service.clone()))
                  // .wrap(YourMiddleware)
                  .configure(crate::routes::configure) // A function in routes/mod.rs
          })
          .bind((host, port))?
          .run()
          .await
      }
  }

  pub fn load_config() -> Arc<Config> {
      let config = Config::builder()
          .add_source(File::with_name("config/default.json"))
          .build()
          .expect("Failed to load configuration");
      Arc::new(config)
  }
  ```

- **`database.rs` Example:**
  ```rust
  use sqlx::{PgPool, postgres::PgPoolOptions};
  use std::sync::Arc;
  use config::Config;

  #[derive(Clone)]
  pub struct DatabaseConnection {
      pool: Arc<PgPool>,
  }

  impl DatabaseConnection {
      pub async fn new(config: &Config) -> Result<Self, sqlx::Error> {
          let database_url = config.get_string("database_url").expect("Database URL must be set.");
          let max_connections = config.get_int("database_pool.max_connections").unwrap_or(10) as u32;
          let pool = PgPoolOptions::new()
              .max_connections(max_connections)
              .connect(&database_url)
              .await?;
          Ok(Self { pool: Arc::new(pool) })
      }
      
      pub fn get_pool(&self) -> Arc<PgPool> {
          self.pool.clone()
      }
  }

  pub async fn initialize_database(config: &Config) -> Result<DatabaseConnection, sqlx::Error> {
      DatabaseConnection::new(config).await
  }
  ```
  *(Similar reference examples should be used for `redis.rs`, `s3.rs`, and `elastic_search.rs` based on the provided Indonesian file.)*

### 4.4. `entities/` Directory

This directory contains all data structure definitions (`struct`s) used throughout the project. This is not limited to database tables.

- **Database Entities**: Structs that map directly to database tables (e.g., `DeviceEntity` for the `devices` table). These should derive `sqlx::FromRow`, `serde::Serialize`, and `serde::Deserialize`.
- **API Entities**: Structs for HTTP request bodies (e.g., `CreateDeviceForm`) and response formats.
- **Service-Level Entities**: Structs used for passing data between services or for internal data processing.

**Example `DeviceEntity` (hypothetical):**
```rust
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct DeviceEntity {
    pub id: Uuid,
    pub device_type_id: Uuid,
    pub name: String,
    pub ip_address: std::net::IpAddr,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### 4.5. `repositories/` Directory

This directory is the data access layer. It is subdivided by the technology used for storage.

- **`repositories/postgresql/`**: Contains modules for interacting with the PostgreSQL database.
  - **Rule:** One file per database table (e.g., `device_postgres_repository.rs` for the `devices` table).
  - Each function (e.g., `create`, `get_by_id`, `update`) should be generic over the `sqlx::Executor`. This allows functions to run within a transaction (`&mut Transaction<'_, Postgres>`) or directly on the pool (`&PgPool`).
  - Functions should accept and return `struct`s defined in the `entities/` directory.

- **`repositories/redis/`**: Contains modules for interacting with Redis.
  - **Rule:** One file per Redis key pattern (e.g., `session_redis_repository.rs` for keys like `session:{session_id}`).
  - Functions will include `set`, `get`, `delete`, etc., for the specific key type.

- **`repositories/storage/`**: Contains modules for interacting with the S3 object storage.
  - **Rule:** One file per logical object type or path (e.g., `device_config_backup_storage.rs` for backups stored under `device-backups/`).
  - Functions will include `put` (upload), `get` (download), `get_presigned_url`, etc.

**Example `device_postgres_repository.rs` function:**
```rust
use sqlx::{Executor, postgres::PgRow, Row};
use crate::entities::device_entity::DeviceEntity;
use uuid::Uuid;

// Helper to map a row to an entity
fn row_to_entity(row: &PgRow) -> DeviceEntity {
    DeviceEntity {
        id: row.get("id"),
        device_type_id: row.get("device_type_id"),
        name: row.get("name"),
        ip_address: row.get("ip_address"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub async fn get_by_id<'a, E>(executor: E, id: &Uuid) -> Result<Option<DeviceEntity>, sqlx::Error>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    let row = sqlx::query("SELECT * FROM devices WHERE id = $1")
        .bind(id)
        .fetch_optional(executor)
        .await?;
    Ok(row.map(|r| row_to_entity(&r)))
}
```

### 4.6. `utils/` Directory

This directory contains stateless, generic helper functions that are not tied to the project's business logic. These utilities can be reused across different projects.

Examples of existing helpers:
- `hash_helper.rs`: For password hashing and verification.
- `uuid_helper.rs`: For generating UUIDs.
- `http_response_helper.rs`: For standardizing JSON API responses.
- `jwt_helper.rs`: For handling JSON Web Tokens.
- `sql_security_helper.rs`, `xss_security_helper.rs`: For input sanitization.

### 4.7. `services/` Directory

This is the core of the application, containing all the business logic.

- **Rule:** Each file represents a specific use case or business process (e.g., `add_new_device.rs`, `update_device_port.rs`).
- **Responsibilities:**
  - Orchestrate calls to different repositories (PostgreSQL, Redis, S3).
  - Use helper functions from the `utils/` directory.
  - Manage database transactions (begin, commit, rollback).
  - Perform data validation and processing.
  - Encapsulate the entire logic for a feature, ensuring separation of concerns.

**Example `add_new_device.rs` service:**
```rust
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_postgres_repository;
use crate::entities::{device_entity::DeviceEntity, /* other entities */};
use crate::utils::uuid_helper;
use chrono::Utc;
use uuid::Uuid;

// The form entity would come from the controller, containing validated input
pub struct AddDeviceForm {
    pub name: String,
    pub device_type_id: Uuid,
    // ... other fields
}

pub async fn execute(db: &DatabaseConnection, form: &AddDeviceForm) -> Result<Uuid, String> {
    let mut tx = db.get_pool().begin().await.map_err(|e| format!("Failed to begin transaction: {}", e))?;
    
    let now = Utc::now();
    let new_device = DeviceEntity {
        id: uuid_helper::generate_v4(),
        name: form.name.clone(),
        device_type_id: form.device_type_id,
        // ... initialize other fields
        created_at: now,
        updated_at: now,
    };

    // Call the repository to create the device within the transaction
    device_postgres_repository::create(&mut *tx, &new_device)
        .await
        .map_err(|e| format!("Failed to create device: {}", e))?;

    // ... perform other related operations, e.g., create default ports ...

    tx.commit().await.map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(new_device.id)
}
```

### 4.8. `controllers/`, `routes/`, `middlewares/`, `validations/`

- **`routes/`**: Defines the HTTP API endpoints and maps them to controller functions. A central `configure` function will be used in `http_server.rs` to register all routes.
- **`controllers/`**: Handles the HTTP request/response cycle. It extracts and validates data from the request, calls the appropriate service, and formats the response.
- **`middlewares/`**: Contains Actix Web middleware for concerns like logging, authentication, authorization, and request ID injection.
- **`validations/`**: Contains reusable validation logic for request data, which can be used by controllers.

## 5. Final Instruction

Your task is to implement the features for this project by strictly following the architecture described above. Ensure that all new code is consistent with the patterns and examples provided. Place business logic in services, data access in repositories, and external connections in infrastructures. Use the provided entities and helpers to maintain a clean and organized codebase.
