# OpenAPI Documentation

This directory contains the OpenAPI 3.0.3 specification for the AdminRadius Infrastructure Service API.

## Quick Start

### Instalasi Dependencies (Optional)
```bash
cd docs/openapi/
npm install
```

### Bundle untuk Production
```bash
# Menggunakan npm scripts (setelah npm install)
npm run bundle

# Atau langsung dengan redocly global
redocly bundle infrastructure_service_adminradius.json -o ~/Downloads/final_infra_adminradius.json

# Atau menggunakan script helper
./bundle.sh ~/Downloads/final_infra_adminradius.json
```

### Preview Dokumentasi
```bash
# Dengan npm scripts
npm run preview

# Atau langsung
redocly preview-docs infrastructure_service_adminradius.json
```

### Validasi
```bash
# Dengan npm scripts
npm run lint

# Atau langsung
redocly lint infrastructure_service_adminradius.json
```

---

## File Structure

The API documentation is split into modular files for better maintainability:

### Main File
- **`infrastructure_service_adminradius.json`** - Main OpenAPI specification file containing:
  - API metadata (title, version, description)
  - Server configurations
  - Common response schemas (BadRequest, NotFound, InternalServerError, etc.)
  - Security schemes
  - Tags definitions
  - **References (`$ref`) to all group files** for paths and schemas

### Group Files
Each group file contains the complete documentation for a specific API endpoint group with full path definitions and schemas:

### Reference Structure
File utama menggunakan `$ref` untuk mereferensikan endpoints dan schemas dari file group:

```json
// Di infrastructure_service_adminradius.json
{
  "paths": {
    "/branch/{branch_id}/devices": {
      "$ref": "./group_device.json#/paths/~1api-infra~1branch~1{branch_id}~1devices"
    }
  },
  "components": {
    "schemas": {
      "Device": {
        "$ref": "./group_device.json#/components/schemas/Device"
      }
    }
  }
}
```

**Note:** Path encoding `~1` = `/`, `~0` = `~` (JSON Pointer RFC 6901)

- **`group_device.json`** - Device management endpoints
  - `GET /api-infra/branch/{branch_id}/devices` - List all devices in a branch
  - `POST /api-infra/branch/{branch_id}/device` - Create a new device
  - `GET /api-infra/branch/{branch_id}/device/{device_id}` - Get device by ID
  - `PUT /api-infra/branch/{branch_id}/device/{device_id}` - Update device
  - `DELETE /api-infra/branch/{branch_id}/device/{device_id}` - Delete device

- **`group_device_type.json`** - Device type management endpoints
  - `GET /api-infra/device-types` - List all device types
  - `POST /api-infra/device-type` - Create a new device type
  - `GET /api-infra/device-type/{id}` - Get device type by ID
  - `PUT /api-infra/device-type/{id}` - Update device type
  - `DELETE /api-infra/device-type/{id}` - Delete device type

- **`group_device_port.json`** - Device port management endpoints
  - `GET /api-infra/device/{device_id}/ports` - List all ports of a device
  - `POST /api-infra/device/{device_id}/port` - Create a new port
  - `GET /api-infra/device/{device_id}/port/{port_id}` - Get port by ID
  - `PUT /api-infra/device/{device_id}/port/{port_id}` - Update port
  - `DELETE /api-infra/device/{device_id}/port/{port_id}` - Delete port

- **`group_device_port_specification.json`** - Port specification management endpoints
  - `GET /api-infra/device-port-specifications` - List all port specifications
  - `POST /api-infra/device-port-specification` - Create a new specification
  - `GET /api-infra/device-port-specification/{id}` - Get specification by ID
  - `PUT /api-infra/device-port-specification/{id}` - Update specification
  - `DELETE /api-infra/device-port-specification/{id}` - Delete specification

- **`group_device_port_interface.json`** - Port interface management endpoints
  - `GET /api-infra/device-port-interfaces` - List all port interfaces
  - `POST /api-infra/device-port-interface` - Create a new interface
  - `GET /api-infra/device-port-interface/{id}` - Get interface by ID
  - `PUT /api-infra/device-port-interface/{id}` - Update interface
  - `DELETE /api-infra/device-port-interface/{id}` - Delete interface

- **`group_device_connection.json`** - Device connection management endpoints
  - `GET /api-infra/device/{device_id}/connections` - List all connections
  - `POST /api-infra/device/{device_id}/connection` - Create a new connection
  - `GET /api-infra/device/{device_id}/connection/{connection_id}` - Get connection by ID
  - `PUT /api-infra/device/{device_id}/connection/{connection_id}` - Update connection
  - `DELETE /api-infra/device/{device_id}/connection/{connection_id}` - Delete connection

- **`group_branch_topology.json`** - Branch topology endpoints
  - `GET /api-infra/branch/{branch_id}/topologies` - Get complete network topology

## Usage

### Viewing the Documentation

#### Option 1: Redocly Preview (Recommended)
Preview dokumentasi interaktif langsung dari file modular:

```bash
# Dari direktori docs/openapi/
redocly preview-docs infrastructure_service_adminradius.json

# Dengan auto-reload saat file berubah
redocly preview-docs infrastructure_service_adminradius.json --port 8080
```

Buka http://localhost:8080 di browser.

#### Option 2: Swagger UI
```bash
# Bundle dulu, kemudian serve dengan Swagger UI
redocly bundle infrastructure_service_adminradius.json -o bundled.json

# Using Docker
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/docs/bundled.json \
  -v $(pwd):/docs \
  swaggerapi/swagger-ui
```

#### Option 3: VS Code Extension
Install extension:
- **OpenAPI (Swagger) Editor** - untuk editing dan preview
- **Redocly OpenAPI** - untuk linting dan preview dengan Redocly

Kemudian buka file `infrastructure_service_adminradius.json`.

### Bundling Files with Redocly

Struktur dokumentasi ini sudah dioptimalkan untuk bundling menggunakan Redocly CLI. File utama `infrastructure_service_adminradius.json` menggunakan `$ref` untuk mereferensikan semua file group.

**Install Redocly CLI:**
```bash
npm install -g @redocly/cli
```

**Cara 1: Menggunakan Script Helper (Recommended)**
```bash
# Bundle ke format JSON (default)
./bundle.sh ~/Downloads/final_infra_adminradius.json

# Bundle ke format YAML
./bundle.sh ~/Downloads/final_infra_adminradius.yaml yaml

# Bundle ke direktori saat ini
./bundle.sh final_infra_adminradius.json
```

Script ini akan:
1. ✅ Validasi spec sebelum bundle
2. 📦 Bundle semua file dengan $ref
3. 📍 Tampilkan lokasi output file
4. 💡 Berikan next steps

**Cara 2: Manual dengan Redocly CLI**
```bash
# Bundle semua file menjadi satu file lengkap
redocly bundle infrastructure_service_adminradius.json -o ~/Downloads/final_infra_adminradius.json

# Atau dengan dereferencing (menghilangkan semua $ref)
redocly bundle infrastructure_service_adminradius.json \
  --dereferenced \
  -o ~/Downloads/final_infra_adminradius.json

# Bundle dengan format YAML
redocly bundle infrastructure_service_adminradius.json \
  --ext yaml \
  -o ~/Downloads/final_infra_adminradius.yaml
```

**Preview dokumentasi sebelum bundle:**
```bash
redocly preview-docs infrastructure_service_adminradius.json
```

**Validate semua file sebelum bundle:**
```bash
# Validasi dengan konfigurasi redocly.yaml
redocly lint infrastructure_service_adminradius.json

# Validasi individual group files
redocly lint group_device.json
redocly lint group_device_type.json
```

### Validating the Specification

```bash
# Validasi file utama (akan otomatis validasi semua referenced files)
redocly lint infrastructure_service_adminradius.json

# Atau dengan npm script
npm run lint

# Validasi dengan output detail
redocly lint infrastructure_service_adminradius.json --format stylish
npm run validate

# Validasi individual group files
redocly lint group_device.json
redocly lint group_device_type.json
redocly lint group_device_port.json

# Generate stats
redocly stats infrastructure_service_adminradius.json
npm run stats
```

## Available NPM Scripts

Setelah menjalankan `npm install`, Anda dapat menggunakan scripts berikut:

| Script | Command | Description |
|--------|---------|-------------|
| `npm run lint` | `redocly lint` | Validasi OpenAPI spec |
| `npm run validate` | `redocly lint --format stylish` | Validasi dengan output detail |
| `npm run bundle` | `redocly bundle` | Bundle ke JSON |
| `npm run bundle:dereferenced` | `redocly bundle --dereferenced` | Bundle tanpa $ref |
| `npm run bundle:yaml` | `redocly bundle --ext yaml` | Bundle ke YAML |
| `npm run preview` | `redocly preview-docs` | Preview dokumentasi |
| `npm run stats` | `redocly stats` | Tampilkan statistik API |

## API Design Patterns

### Request Format
All POST and PUT requests accept JSON payloads with validation:
- String fields are sanitized (max 255 chars for names)
- XSS protection is applied automatically
- UUID fields must be valid UUID v4 format (36 characters)
- Optional fields default to empty objects `{}` where applicable

### Response Format
All responses follow this structure:

```json
{
  "status": {
    "code": 200,
    "message": "Ok"
  },
  "request_id": "req_abc123xyz",
  "data": {
    "item": { /* resource object */ }
    // or
    "items": [ /* array of resources */ ]
    // or
    "deleted": true
  }
}
```

### Error Responses
Error responses include detailed validation messages:

```json
{
  "status": {
    "code": 400,
    "message": "Bad Request"
  },
  "request_id": "req_abc123xyz",
  "data": {
    "errors": [
      "name is required",
      "device_type_id must be a valid UUID"
    ]
  }
}
```

### Common Validation Rules
- **UUID fields**: Must be exactly 36 characters (UUID v4 format)
- **Name fields**: Required, max 255 characters, XSS sanitized
- **Latitude**: -90 to 90
- **Longitude**: -180 to 180
- **Position**: Must be >= 0
- **JSON fields**: Default to `{}` if not provided

## Related Files

The API implementation can be found in:
- Routes: `src/routes/`
- Controllers: `src/controllers/`
- Services: `src/services/`
- Entities: `src/entities/`
- Validations: `src/validations/`

## Notes

1. **Path Prefix**: All endpoints are prefixed with `/api-infra` as configured in `config/default.json`
2. **HTTP Server**: The service runs on port 8014 by default (configurable)
3. **Database**: PostgreSQL with SQLx for type-safe queries
4. **Caching**: Redis integration for performance optimization
5. **Storage**: MinIO S3-compatible object storage
6. **Logging**: Elasticsearch integration for request/response logging
7. **Request Tracking**: All responses include `x-request-id` header for tracing

## Maintenance

When adding new endpoints:
1. Create the route in `src/routes/`
2. Create the controller in `src/controllers/`
3. Create validation schemas in `src/validations/`
4. Create entity definitions in `src/entities/`
5. Update the corresponding `group_*.json` file in this directory
6. Ensure the main `infrastructure_service_adminradius.json` references it properly

## Support

For questions or issues with the API documentation:
- Contact: AdminRadius Team
- Email: support@adminradius.com
