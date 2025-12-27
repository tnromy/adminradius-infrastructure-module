# Device Search Feature Implementation

## Overview

Add optional `search` query parameter to the GET branch devices endpoint to filter devices by name.

## Current State Analysis

### Endpoint
- **Route**: `GET /api-infra/branch/{branch_id}/devices`
- **Controller**: `src/controllers/device_controller.rs` - `index` function
- **Service**: `src/services/get_all_devices.rs`
- **Repository**: `src/repositories/postgresql/device_postgres_repository.rs` - `get_all_by_branch`
- **OpenAPI**: `docs/openapi/group_device.json`

### Current Repository Query
```sql
SELECT ... FROM devices d
LEFT JOIN device_types dt ON dt.id = d.device_type_id
WHERE d.branch_id = $1
ORDER BY LOWER(d.name)
```

### Database Index Status
Migration `20250923032100_create_devices_table.up.sql` already has:
```sql
CREATE INDEX IF NOT EXISTS idx_devices_lower_name ON devices(LOWER(name));
```
✅ Index exists - no migration changes needed.

### Security Helper Available
`src/utils/sql_security_helper.rs` provides:
```rust
pub fn sanitize_search_keyword(input: &str) -> String
```
This function:
- Trims whitespace
- Lowercases
- Removes control characters
- Removes SQL wildcards (%, _) to prevent injection
- Caps length to 120 chars

## Implementation Plan

### 1. Repository Layer
Update `get_all_by_branch` to accept optional search parameter:
```rust
pub async fn get_all_by_branch<'a, E>(
    executor: E,
    branch_id: &str,
    search: Option<&str>,
) -> Result<Vec<DeviceEntity>, sqlx::Error>
```

SQL with search:
```sql
WHERE d.branch_id = $1
  AND ($2::TEXT IS NULL OR LOWER(d.name) LIKE '%' || $2 || '%')
```

Note: Using parameterized query with bind prevents SQL injection. The search value is pre-sanitized by the helper.

### 2. Service Layer
Update `execute` signature:
```rust
pub async fn execute(
    db: &DatabaseConnection,
    branch_id: &str,
    search: Option<&str>,
) -> Result<Vec<DeviceEntity>, sqlx::Error>
```

### 3. Controller Layer
Add query struct with search field:
```rust
#[derive(Debug, Deserialize)]
pub struct DeviceIndexQuery {
    #[serde(default)]
    search: Option<String>,
}
```

Sanitize in controller using `sql_security_helper::sanitize_search_keyword`.

### 4. OpenAPI Documentation
Add `search` query parameter to GET `/api-infra/branch/{branch_id}/devices`.

## Files to Modify

1. `src/repositories/postgresql/device_postgres_repository.rs` - Add search param to get_all_by_branch
2. `src/services/get_all_devices.rs` - Pass search param to repository
3. `src/controllers/device_controller.rs` - Add query params, sanitize, pass to service
4. `docs/openapi/group_device.json` - Document search parameter

## Security Considerations

1. **SQL Injection Prevention**:
   - Use parameterized queries (SQLx bind)
   - Pre-sanitize input with `sanitize_search_keyword`
   - Remove wildcards from user input

2. **XSS Prevention**:
   - Sanitize before storage/display
   - Already using `xss_security_helper` in controller

3. **Performance**:
   - Index `idx_devices_lower_name` covers `LOWER(name)` searches
   - Length cap (120 chars) prevents excessive pattern matching
