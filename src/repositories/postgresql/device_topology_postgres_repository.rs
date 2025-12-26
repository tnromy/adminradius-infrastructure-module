use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

use crate::entities::device_entity::DeviceEntity;
use crate::entities::device_type_entity::DeviceTypeEntity;

#[derive(Debug, Clone)]
pub struct DeviceTopologyNode {
    pub device: DeviceEntity,
    pub parent_device_id: Option<String>,
    pub parent_device_port_id: Option<String>,
    pub uplink_port_id: Option<String>,
    pub connection_id: Option<String>,
    pub connection_details: Option<Value>,
    pub level: i32,
}

fn row_to_device(row: &PgRow) -> DeviceEntity {
    // Parse device_type from joined columns (if available)
    let device_type = match row.try_get::<String, _>("dt_id") {
        Ok(id) => Some(DeviceTypeEntity {
            id,
            name: row.get("dt_name"),
            created_at: row.get::<DateTime<Utc>, _>("dt_created_at"),
            updated_at: row.get("dt_updated_at"),
        }),
        Err(_) => None,
    };

    DeviceEntity {
        id: row.get("device_id"),
        branch_id: row.get("d_branch_id"),
        name: row.get("d_name"),
        device_type_id: row.get("d_device_type_id"),
        latitude: row.get("d_latitude"),
        longitude: row.get("d_longitude"),
        location_details: row.get("d_location_details"),
        specifications: row.get("d_specifications"),
        created_at: row.get("d_created_at"),
        updated_at: row.get("d_updated_at"),
        device_type,
    }
}

pub async fn get_branch_topology<'a, E>(
    executor: E,
    branch_id: &str,
    limit_level: Option<i32>,
    active_device_id: Option<&str>,
) -> Result<Vec<DeviceTopologyNode>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            WITH RECURSIVE device_edges AS (
                SELECT
                    fp.device_id AS from_device_id,
                    tp.device_id AS to_device_id,
                    dc.id AS connection_id,
                    dc.from_port_id,
                    dc.to_port_id,
                    dc.details,
                    dc.created_at,
                    dc.updated_at
                FROM device_connections dc
                JOIN device_ports fp ON fp.id = dc.from_port_id
                JOIN devices fd ON fd.id = fp.device_id
                JOIN device_ports tp ON tp.id = dc.to_port_id
                JOIN devices td ON td.id = tp.device_id
                WHERE fd.branch_id = $1 AND td.branch_id = $1
            ),
            roots AS (
                SELECT d.id AS device_id
                FROM devices d
                WHERE d.branch_id = $1
                  AND NOT EXISTS (
                      SELECT 1
                      FROM device_edges e
                      WHERE e.to_device_id = d.id
                  )
            ),
            full_topology AS (
                SELECT
                    r.device_id,
                    NULL::TEXT AS parent_device_id,
                    NULL::TEXT AS parent_device_port_id,
                    NULL::TEXT AS uplink_port_id,
                    NULL::TEXT AS connection_id,
                    NULL::JSONB AS connection_details,
                    0 AS level,
                    ARRAY[r.device_id]::TEXT[] AS path
                FROM roots r

                UNION ALL

                SELECT
                    e.to_device_id,
                    e.from_device_id AS parent_device_id,
                    e.from_port_id AS parent_device_port_id,
                    e.to_port_id AS uplink_port_id,
                    e.connection_id,
                    e.details AS connection_details,
                    t.level + 1 AS level,
                    path || e.to_device_id
                FROM full_topology t
                JOIN device_edges e ON e.from_device_id = t.device_id
                WHERE ($2::INTEGER IS NULL OR t.level < $2)
                    AND NOT e.to_device_id = ANY(path)
            ),
            -- Find ancestors of active device (path from active device to root)
            ancestor_chain AS (
                SELECT 
                    ft.device_id,
                    ft.parent_device_id,
                    ft.level
                FROM full_topology ft
                WHERE ft.device_id = $3::TEXT
                
                UNION ALL
                
                SELECT 
                    ft.device_id,
                    ft.parent_device_id,
                    ft.level
                FROM ancestor_chain ac
                JOIN full_topology ft ON ft.device_id = ac.parent_device_id
            ),
            -- Collect all parent device IDs from the ancestor chain
            ancestor_parent_ids AS (
                SELECT DISTINCT parent_device_id 
                FROM ancestor_chain 
                WHERE parent_device_id IS NOT NULL
            ),
            -- Determine which devices to include
            included_devices AS (
                -- When no active_device_id ($3 IS NULL), include everything
                SELECT device_id FROM full_topology WHERE $3::TEXT IS NULL
                
                UNION
                
                -- Include all ancestors
                SELECT device_id FROM ancestor_chain WHERE $3::TEXT IS NOT NULL
                
                UNION
                
                -- Include siblings of each ancestor (same parent as any ancestor)
                SELECT ft.device_id 
                FROM full_topology ft
                WHERE $3::TEXT IS NOT NULL
                  AND ft.parent_device_id IN (SELECT parent_device_id FROM ancestor_chain)
            ),
            -- Final filtered topology
            topology AS (
                SELECT 
                    ft.device_id,
                    ft.parent_device_id,
                    ft.parent_device_port_id,
                    ft.uplink_port_id,
                    ft.connection_id,
                    ft.connection_details,
                    ft.level,
                    ft.path
                FROM full_topology ft
                WHERE ft.device_id IN (SELECT device_id FROM included_devices)
            )
            SELECT
                t.device_id,
                t.parent_device_id,
                t.parent_device_port_id,
                t.uplink_port_id,
                t.connection_id,
                t.connection_details,
                t.level,
                d.branch_id AS d_branch_id,
                d.name AS d_name,
                d.device_type_id AS d_device_type_id,
                d.latitude AS d_latitude,
                d.longitude AS d_longitude,
                d.location_details AS d_location_details,
                d.specifications AS d_specifications,
                d.created_at AS d_created_at,
                d.updated_at AS d_updated_at,
                dt.id AS dt_id,
                dt.name AS dt_name,
                dt.created_at AS dt_created_at,
                dt.updated_at AS dt_updated_at
            FROM topology t
            JOIN devices d ON d.id = t.device_id
            LEFT JOIN device_types dt ON dt.id = d.device_type_id
            ORDER BY t.path
        "#,
    )
    .bind(branch_id)
    .bind(limit_level)
    .bind(active_device_id)
    .fetch_all(executor)
    .await?;

    Ok(rows
        .iter()
        .map(|row| DeviceTopologyNode {
            device: row_to_device(row),
            parent_device_id: row.get("parent_device_id"),
            parent_device_port_id: row.get("parent_device_port_id"),
            uplink_port_id: row.get("uplink_port_id"),
            connection_id: row.get("connection_id"),
            connection_details: row.get("connection_details"),
            level: row.get("level"),
        })
        .collect())
}
