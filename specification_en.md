# AI Agent Prompt: Feature Implementation for Rust Network Device Management Service

## 1. Introduction & High-Level Goal

Your primary task is to implement a series of features for the Rust-based network device management service. The implementation must strictly follow the architecture defined in `arsitektur_en.md`. You will work through a list of features in a specific, sequential order, as they have dependencies on each other.

For each feature, you will implement a full "vertical slice" of functionality, covering these layers in order:
1.  **Entity**: Define the data structure.
2.  **Repository**: Create the data access layer functions.
3.  **Services**: Implement the core business logic.
4.  **Validations**: Create input validation logic.
5.  **Controller**: Handle the HTTP request/response lifecycle.
6.  **Routes**: Define the API endpoints.

The features are based on the database tables defined in the `migrations/` directory. You must implement them in the order presented below.

## 2. General Instructions & Best Practices

- **Configuration**: All external service configurations (database credentials, Redis/S3 settings, server ports, etc.) **must** be read from `config/default.json`.
- **ID & Timestamps**: For all `create` operations, the primary `id` field must be generated using the `uuid_helper` from the `utils/` directory. The `created_at` and `updated_at` columns must be populated with the current timestamp.
- **SQL Security**: Ensure all PostgreSQL queries, especially in repositories, are protected against SQL injection. Use `sqlx`'s parameter binding (`$1`, `$2`, etc.) exclusively.
- **XSS Security**: Sanitize all user-provided input in the controller layer before passing it to services to prevent XSS attacks. Use helpers from the `utils/` directory.
- **Middleware & Logging**: All endpoints must be protected by the `log_middleware` and `include_request_id_middleware`. Controllers are responsible for preparing detailed log data. The middleware will then persist this log to Elasticsearch, including the unique request ID in every response.
- **No Auth**: This service runs behind an API Gateway. You do not need to implement any authentication or authorization logic.
- **Verification**: After completing each vertical slice (e.g., after finishing all endpoints for "Device Types"), run `cargo check` to verify the code. Do not use `cargo run` as it will block the process.
- **Handling Warnings**:
    - If you get a warning about an **unused function**, do not delete it. Mark it with `#[allow(dead_code)]` as it will likely be used later.
    - If you get a warning about an **unused variable**, investigate it. It is likely a bug or unnecessary code and should probably be removed.
- **Module System**: Remember to update the corresponding `mod.rs` file whenever you create a new file in a directory to make it part of the module tree.
- **API Documentation**: After implementing each endpoint, you must document it in OpenAPI 3.0 format in the `docs/infrastructures.json` file. Include the path, method, parameters (path, query), request body, and example responses.

---

## 3. Feature Implementation Plan (Sequential)

### Feature 1: Device Port Specifications

This table stores the detailed specifications of a network port (e.g., the technical details of a "Gigabit Ethernet" RJ45 port vs. a "Fast Ethernet" RJ45 port).

1.  **Table Schema**: Analyze the migration file `20250923032049_create_device_port_specifications_table.up.sql` to understand all columns and their data types.
2.  **Entity**:
    - Create `src/entities/device_port_specification_entity.rs`.
    - The struct properties must match the table columns.
    - The `data` column in the database is of type `JSONB`. The corresponding struct field must be dynamic to handle unstructured data. Use `serde_json::Value` for this field.
3.  **Repository**:
    - Create `src/repositories/postgresql/device_port_specification_postgres_repository.rs`.
    - Implement full, generic CRUD functions (`create`, `get_by_id`, `get_all`, `update`, `delete`).
    - The `name` column must be unique. Add a function to check for name existence.
    - Add a function `exists(id: &Uuid)` for validation purposes.
    - All functions must be generic over the `sqlx::Executor` to support both transactions and direct pool connections.
4.  **Services**:
    - Create the following files in `src/services/`:
        - `add_device_port_specification.rs`
        - `update_device_port_specification.rs`
        - `get_device_port_specification.rs` (for a single record)
        - `get_all_device_port_specifications.rs` (for a list)
        - `delete_device_port_specification.rs`
    - Implement the business logic in each file, calling the repository as needed.
5.  **Validations**:
    - Create a new directory `src/validations/device_port_specification/`.
    - Inside, create `store_validation.rs` and `update_validation.rs` to validate incoming request data.
6.  **Controller**:
    - Create `src/controllers/device_port_specification_controller.rs`.
    - Implement handler functions (`index`, `store`, `show`, `update`, `destroy`).
    - In `store` and `update`, first, pass the request data to the appropriate validation module.
    - After validation, sanitize inputs, then call the corresponding service.
    - Use `http_response_helper.rs` to wrap the service result into a standard JSON response (e.g., 200, 404, 500).
7.  **Routes**:
    - Create `src/routes/device_port_specification_route.rs`.
    - Define the following endpoints and map them to the controller functions:
        - `GET /device-port-specifications` -> `index()`
        - `POST /device-port-specifications` -> `store()`
        - `GET /device-port-specifications/{id}` -> `show()`
        - `PUT /device-port-specifications/{id}` -> `update()`
        - `DELETE /device-port-specifications/{id}` -> `destroy()`

---

### Feature 2: Device Port Interfaces

This table stores the physical interface type of a port (e.g., `RJ45`, `RJ11`, `SFP`).

1.  **Table Schema**: Analyze `20250923032050_create_device_port_interfaces_table.up.sql`.
2.  **Implementation**: Follow the exact same vertical slice process as in **Feature 1** to implement full CRUD functionality (Entity, Repository, Services, Validations, Controller, Routes).

---

### Feature 3: Device Types

This table stores the different types of network devices (e.g., `Router`, `Switch`, `OLT`, `ONT`).

1.  **Table Schema**: Analyze `20250923032051_create_device_types_table.up.sql`.
2.  **Implementation**: Follow the exact same vertical slice process as in **Feature 1** to implement full CRUD functionality.

---

### Feature 4: Devices

This is a core table that stores information about individual network devices.

1.  **Table Schema**: Analyze `20250923032100_create_devices_table.up.sql`.
2.  **Routes**: The routes for this feature have a special structure. They are prefixed with a `branch_id`.
    - `GET /branch/{branch_id}/devices`
    - `POST /branch/{branch_id}/device`
    - `GET /branch/{branch_id}/device/{device_id}`
    - `PUT /branch/{branch_id}/device/{device_id}`
    - `DELETE /branch/{branch_id}/device/{device_id}`
    - The `branch_id` is part of the URL path, not the request body. It must be extracted from the path in the controller.
3.  **Entity**:
    - Create `src/entities/device_entity.rs`.
    - The `device_type_id` column is a foreign key. In the entity, add an optional property `pub device_type: Option<DeviceTypeEntity>` to hold the joined data.
    - The `branch_id` column is just a string and not a foreign key; no special handling is needed in the entity beyond its `String` type.
    - Handle the unstructured `JSONB` columns by using `serde_json::Value`.
4.  **Repository**:
    - Create `src/repositories/postgresql/device_postgres_repository.rs`.
    - In `get` functions, perform a `JOIN` with the `device_types` table to populate the `device_type` field in the entity. This must be done in a single query.
    - Ensure `create` and `update` functions can correctly handle `serde_json::Value` for the JSONB columns.
5.  **Validations**:
    - When validating `store` and `update` requests, you must check that the provided `device_type_id` exists in the database by calling the `exists` function in the `device_type_postgres_repository`.
    - The `branch_id` from the path should be validated as a 36-character string and sanitized.
6.  **Implementation**: Complete the rest of the vertical slice (Services, Controller) following the established pattern.

---

### Feature 5: Device Ports

This table links ports to their parent device. A router might have 4 ports, a switch 8, etc.

1.  **Table Schema**: Analyze `20250923032110_create_device_ports_table.up.sql`.
2.  **Routes**: These routes are nested under a specific device.
    - `GET /device/{device_id}/ports`
    - `POST /device/{device_id}/port`
    - etc...
    - The `device_id` is part of the URL path and must be extracted in the controller. It should not be part of the request body.
3.  **Entity**:
    - This table has foreign keys to `devices`, `device_port_interfaces`, and `device_port_specifications`.
    - In the entity, create three corresponding optional properties to hold the joined data:
        - `pub device: Option<DeviceEntity>`
        - `pub port_interface: Option<DevicePortInterfaceEntity>`
        - `pub port_specification: Option<DevicePortSpecificationEntity>`
    - Handle the `properties` `JSONB` column with `serde_json::Value`.
4.  **Repository**:
    - In `get` functions, perform `JOIN`s with the three related tables to populate the optional fields in the entity. This must be done in a single, efficient query.
5.  **Validations**:
    - For `store` and `update`, validate that the `device_id` (from path), `port_interface_id`, and `port_specification_id` all exist by calling the `exists` function in their respective repositories.
6.  **Implementation**: Complete the rest of the vertical slice.

---

### Feature 6: Device Connections

This is a crucial table that models the physical connections between device ports.

1.  **Table Schema**: Analyze `20250923032120_create_device_connections_table.up.sql`.
    - The core columns are `from_port_id` and `to_port_id`.
    - If any other columns besides `id`, `from_port_id`, and `to_port_id` are marked as `NOT NULL`, modify the migration to make them optional. These three are the only required fields for a connection.
2.  **Entity & Repository**:
    - This table has foreign keys to `device_ports` for both `from_port_id` and `to_port_id`.
    - In the entity, create optional properties `from_port: Option<DevicePortEntity>` and `to_port: Option<DevicePortEntity>`.
    - In the repository's `get` functions, you will need to perform two `JOIN`s to the `device_ports` table (using aliases) to populate both `from_port` and `to_port`.
3.  **Implementation**: Complete the full vertical slice for this feature, creating CRUD functionality to manage connections between ports.
