# Active Device Topology Feature Implementation

## Overview

Add `active_device_id` query parameter to the branch topology endpoint to filter the topology tree, showing only devices related to the active device (ancestors, siblings of ancestors, and descendants at active device level).

## Current State Analysis

### Endpoint
- **Route**: `GET /api-infra/branch/{branch_id}/topologies`
- **Controller**: `src/controllers/branch_topology_controller.rs`
- **Service**: `src/services/get_branch_topology.rs`
- **Repository**: `src/repositories/postgresql/device_topology_postgres_repository.rs`
- **OpenAPI**: `docs/openapi/group_branch_topology.json`

### Current Query Parameters
- `limit_level: Option<i32>` - Limits the depth of topology traversal

### Current SQL Query Structure
```sql
WITH RECURSIVE device_edges AS (
    -- Build edge graph from device_connections
),
roots AS (
    -- Find root devices (no incoming edges)
),
topology AS (
    -- Recursive CTE starting from roots, going down
)
SELECT ... FROM topology
```

## Feature Requirements

### New Query Parameter
- **Name**: `active_device_id`
- **Type**: `Option<String>` (UUID)
- **Required**: No
- **Default behavior** (when not provided): Return full topology (current behavior)

### Filter Logic When `active_device_id` is Provided

Given a device hierarchy:
```
root (level 0)
├── OLT1 (level 1)
├── OLT2 (level 1)
│   ├── ODC4 (level 2)
│   │   ├── ODP10 (level 3)
│   │   ├── ODP11 (level 3)  ← active_device_id
│   │   └── ODP12 (level 3)
│   ├── ODC5 (level 2)
│   └── ODC6 (level 2)
└── OLT3 (level 1)
```

When `active_device_id = ODP11`, return:
```
root (level 0)           ← ancestor
├── OLT1 (level 1)       ← sibling of ancestor (OLT2)
├── OLT2 (level 1)       ← ancestor
│   ├── ODC4 (level 2)   ← ancestor
│   │   ├── ODP10        ← sibling of active
│   │   ├── ODP11        ← ACTIVE DEVICE
│   │   └── ODP12        ← sibling of active
│   ├── ODC5 (level 2)   ← sibling of ancestor (ODC4)
│   └── ODC6 (level 2)   ← sibling of ancestor (ODC4)
└── OLT3 (level 1)       ← sibling of ancestor (OLT2)
```

### Algorithm Summary

1. Find the active device and build its ancestor path (from active up to root)
2. For each level, include:
   - The ancestor at that level
   - All siblings of that ancestor (devices with the same parent)
3. At the active device's level, include the active device and its siblings

### Devices to Include
- **Ancestor chain**: All devices from active device up to root
- **Siblings of each ancestor**: Devices sharing the same parent as each ancestor
- **Siblings of active device**: Devices sharing the same parent as active device

### Devices to Exclude
- Descendants of siblings (e.g., children of OLT1, OLT3, ODC5, ODC6)
- Any device below the active device's level

## Implementation Strategy

### Option A: Single Query with Additional CTE (RECOMMENDED)
Add CTEs to:
1. Find ancestor path of active_device_id
2. Find siblings at each ancestor level
3. Filter the topology to include only relevant devices

**Pros**: Single database round-trip, efficient
**Cons**: More complex SQL

### Option B: Separate Query Function
Create a new function `get_branch_topology_focused` for when active_device_id is provided.

**Pros**: Cleaner separation, easier to test
**Cons**: Code duplication

### Decision: Use Option A
Modify existing query with conditional logic using `$3::TEXT` parameter. When NULL, behave as current. When provided, apply the filter.

## SQL Query Design

```sql
WITH RECURSIVE 
-- 1. Build edge graph (existing)
device_edges AS (...),

-- 2. Find ancestor path when active_device_id is provided
ancestor_path AS (
    -- Base: start from active device
    SELECT device_id, parent_device_id, 0 as distance
    FROM full_topology
    WHERE device_id = $3::TEXT
    
    UNION ALL
    
    -- Recurse up to root
    SELECT ft.device_id, ft.parent_device_id, ap.distance + 1
    FROM ancestor_path ap
    JOIN full_topology ft ON ft.device_id = ap.parent_device_id
),

-- 3. Find all parents in ancestor chain
ancestor_parents AS (
    SELECT parent_device_id FROM ancestor_path WHERE parent_device_id IS NOT NULL
    UNION
    SELECT device_id FROM ancestor_path  -- include active device's parent
),

-- 4. Get devices to include: ancestors + siblings of ancestors
included_devices AS (
    -- When no active_device_id, include all
    SELECT device_id FROM full_topology WHERE $3::TEXT IS NULL
    
    UNION
    
    -- Ancestor chain
    SELECT device_id FROM ancestor_path WHERE $3::TEXT IS NOT NULL
    
    UNION
    
    -- Siblings of each ancestor (same parent)
    SELECT ft.device_id 
    FROM full_topology ft
    WHERE $3::TEXT IS NOT NULL
      AND ft.parent_device_id IN (SELECT parent_device_id FROM ancestor_path)
),

-- 5. Filter topology
topology AS (
    SELECT * FROM full_topology
    WHERE device_id IN (SELECT device_id FROM included_devices)
)
```

## Files to Modify

1. **Controller** (`branch_topology_controller.rs`)
   - Add `active_device_id: Option<String>` to `BranchTopologyQuery`
   - Add sanitization for the new parameter
   - Pass to service

2. **Service** (`get_branch_topology.rs`)
   - Update function signature to accept `active_device_id: Option<&str>`
   - Pass to repository

3. **Repository** (`device_topology_postgres_repository.rs`)
   - Update function signature
   - Modify SQL query with conditional filtering

4. **OpenAPI** (`group_branch_topology.json`)
   - Add `active_device_id` parameter documentation

## Testing Scenarios

1. No `active_device_id` - should return full topology (regression test)
2. `active_device_id` = root device - should return root and all level 1 children only
3. `active_device_id` = leaf device - should return full ancestor chain with siblings
4. `active_device_id` = mid-level device - should return ancestors up + siblings + own siblings
5. Invalid `active_device_id` - should return empty array (device not found)
6. `active_device_id` from different branch - should return empty array

## Implementation Order

1. Update repository with new SQL query
2. Update service to pass new parameter
3. Update controller with new query param
4. Build and test
5. Update OpenAPI documentation
6. Bundle OpenAPI with redocly
