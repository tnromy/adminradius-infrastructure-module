# Device Firmware Feature Implementation

## Overview

Implement two new tables: `device_firmwares` and `device_firmware_scripts` with full CRUD operations following project conventions.

## Database Schema

### Table: device_firmwares
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL, UNIQUE |
| version | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### Table: device_firmware_scripts
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PRIMARY KEY |
| device_firmware_id | VARCHAR(36) | NOT NULL, FK to device_firmwares(id) |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| script_text | TEXT | NOT NULL |
| script_params | JSONB | DEFAULT '[]'::jsonb, array of strings |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

## API Routes

### Device Firmware
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /device-firmwares | index | Get all device firmwares |
| POST | /device-firmware | store | Create new firmware |
| GET | /device-firmware/{device_firmware_id} | show | Get firmware by ID |
| PUT | /device-firmware/{device_firmware_id} | update | Update firmware |
| DELETE | /device-firmware/{device_firmware_id} | destroy | Delete firmware |

### Device Firmware Script
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /device-firmware/{device_firmware_id}/scripts | index | Get all scripts for firmware |
| POST | /device-firmware/{device_firmware_id}/script | store | Create new script |
| GET | /device-firmware/{device_firmware_id}/script/{device_firmware_script_id} | show | Get script by ID |
| PUT | /device-firmware/{device_firmware_id}/script/{device_firmware_script_id} | update | Update script |
| DELETE | /device-firmware/{device_firmware_id}/script/{device_firmware_script_id} | destroy | Delete script |

## Files to Create/Modify

### Migrations (4 files)
1. `20250923032070_create_device_firmwares_table.up.sql`
2. `20250923032070_create_device_firmwares_table.down.sql`
3. `20251230064702_create_device_firmware_scripts_table.up.sql`
4. `20251230064702_create_device_firmware_scripts_table.down.sql`

### Entities (2 files)
1. `src/entities/device_firmware_entity.rs`
2. `src/entities/device_firmware_script_entity.rs`
- Update `src/entities/mod.rs`

### Repositories (2 files)
1. `src/repositories/postgresql/device_firmware_postgres_repository.rs`
2. `src/repositories/postgresql/device_firmware_script_postgres_repository.rs`
- Update `src/repositories/postgresql/mod.rs`

### Services (10 files)
Device Firmware:
1. `add_device_firmware.rs`
2. `get_all_device_firmwares.rs`
3. `get_device_firmware.rs`
4. `update_device_firmware.rs`
5. `delete_device_firmware.rs`

Device Firmware Script:
6. `add_device_firmware_script.rs`
7. `get_all_device_firmware_scripts.rs`
8. `get_device_firmware_script.rs`
9. `update_device_firmware_script.rs`
10. `delete_device_firmware_script.rs`
- Update `src/services/mod.rs`

### Validations (4 folders/files)
1. `src/validations/device_firmware/mod.rs`
2. `src/validations/device_firmware/store_validation.rs`
3. `src/validations/device_firmware/update_validation.rs`
4. `src/validations/device_firmware_script/mod.rs`
5. `src/validations/device_firmware_script/store_validation.rs`
6. `src/validations/device_firmware_script/update_validation.rs`
- Update `src/validations/mod.rs`

### Controllers (2 files)
1. `src/controllers/device_firmware_controller.rs`
2. `src/controllers/device_firmware_script_controller.rs`
- Update `src/controllers/mod.rs`

### Routes (2 files)
1. `src/routes/device_firmware_route.rs`
2. `src/routes/device_firmware_script_route.rs`
- Update `src/routes/mod.rs`

### OpenAPI Documentation (3 files)
1. `docs/openapi/group_device_firmware.json`
2. `docs/openapi/group_device_firmware_script.json`
- Update `docs/openapi/infra.adminradius.com.json`

## Middleware Pattern
Following existing pattern (e.g., device_type_route.rs):
- `AllowedBranchesMiddleware`
- `AuthenticationMiddleware`

## Special Notes

### script_params field
- Stored as JSONB array of strings
- Request/Response format: `["param1", "param2", ...]`
- Represents parameter keys that must exist in the script

## Project Conventions Observed

1. **Entity naming**: `{name}_entity.rs`
2. **Repository naming**: `{name}_postgres_repository.rs`
3. **Service naming**: `{action}_{name}.rs` (e.g., `add_device_firmware.rs`)
4. **Controller naming**: `{name}_controller.rs`
5. **Route naming**: `{name}_route.rs`
6. **Validation folder**: `src/validations/{name}/` with `mod.rs`, `store_validation.rs`, `update_validation.rs`
7. **Route paths**: Plural for list (`/device-firmwares`), singular for CRUD (`/device-firmware`, `/device-firmware/{id}`)
