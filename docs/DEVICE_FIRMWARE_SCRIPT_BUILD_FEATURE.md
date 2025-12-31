# Device Firmware Script Build Feature - Implementation Notes

## Overview
This document captures the implementation plan for two tasks:
1. Restructuring device firmware script routes (GET/PUT/DELETE)
2. Adding a new build endpoint for device firmware scripts

---

## Task 1: Route Restructuring

### Current Routes (to be changed)
```
/device-firmware/{device_firmware_id}/script/{id} [GET, PUT, DELETE]
```

### New Routes
```
/device-firmware-script/{id} [GET, PUT, DELETE]
```

### Rationale
Each script has a unique ID, so the parent `device_firmware_id` is redundant for GET/PUT/DELETE operations.

### Files to Modify
1. `src/routes/device_firmware_route.rs` - Split routes, add new scope
2. `src/controllers/device_firmware_script_controller.rs` - Simplify path structs for show/update/destroy
3. `docs/openapi/group_device_firmware.json` - Update paths and remove device_firmware_id parameter
4. `docs/openapi/infra.adminradius.com.json` - Update $ref paths

---

## Task 2: Build Endpoint

### New Route
```
GET /device-firmware-script/{device_firmware_script_id}/build
```

### Request Body
```json
{
  "script_params_data": { "key1": "value1", "key2": "value2" },
  "filename": "file1.scr"
}
```

### Validation Logic (in service, not validation folder)
1. Fetch script from database by ID
2. Parse `script_params` (array of strings) from database
3. Check that all keys in `script_params` exist in `script_params_data`
4. If validation fails, return error immediately

### Processing Flow
1. Service: `build_device_firmware_script.rs`
   - Fetch script entity from DB
   - Validate script_params vs script_params_data keys
   - Call helper function to render template
   - Return rendered text

2. Helper: `src/utils/script_builder.rs`
   - Use `handlebars` crate
   - Disable HTML escaping (for RouterOS scripts)
   - Function signature: `fn render_script(template: &str, data: &serde_json::Value) -> Result<String, Error>`

3. Controller: `device_firmware_script_controller.rs`
   - Add `build` handler
   - Return file response with Content-Disposition header

4. Response Helper: `src/utils/http_response_helper.rs`
   - Add function for file download response

### Response
- Content-Type: `text/plain` or `application/octet-stream`
- Content-Disposition: `attachment; filename="<filename>"`
- Body: Rendered script text

---

## File Structure Reference

### Routes Pattern
- List: `/device-firmwares` (GET)
- Create: `/device-firmware` (POST)
- CRUD: `/device-firmware/{id}` (GET/PUT/DELETE)
- Nested List: `/device-firmware/{id}/scripts` (GET)
- Nested Create: `/device-firmware/{id}/script` (POST)
- **NEW**: Standalone CRUD: `/device-firmware-script/{id}` (GET/PUT/DELETE)
- **NEW**: Build: `/device-firmware-script/{id}/build` (GET with body)

### Controller Pattern
- Path structs for extracting URL parameters
- Validation in separate validation folder OR inline in service
- Response helpers for consistent JSON structure
- Error handling with custom error types

### Service Pattern
- Input struct for parameters
- Error enum with thiserror
- async execute function
- Database access via repository

### OpenAPI Pattern
- Modular JSON files in `docs/openapi/`
- Main file: `infra.adminradius.com.json`
- $ref pattern: `./group_xxx.json#/paths/~1api-infra~1endpoint-path`
- Bundle command: `npx @redocly/cli bundle infra.adminradius.com.json -o bundled.json`

---

## Dependencies to Add
```toml
handlebars = "5"
```

---

## Implementation Order
1. Add handlebars to Cargo.toml
2. Create script_builder.rs helper
3. Create build_device_firmware_script.rs service
4. Update routes (restructure + add build)
5. Update controller (simplify paths + add build handler)
6. Add file response helper function
7. Update OpenAPI documentation
8. Update main OpenAPI file references
9. Build and test
10. Bundle OpenAPI
