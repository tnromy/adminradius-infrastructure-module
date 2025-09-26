use serde_json::Value;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

use crate::entities::device_connection_entity::DeviceConnectionEntity;
use crate::entities::device_port_entity::DevicePortEntity;

fn map_from_port(row: &PgRow) -> Option<DevicePortEntity> {
    match row.try_get::<String, _>("fp_id") {
        Ok(id) => Some(DevicePortEntity {
            id,
            device_id: row.get("fp_device_id"),
            port_type_id: row.get("fp_port_type_id"),
            port_specification_id: row.get("fp_port_specification_id"),
            name: row.get("fp_name"),
            position: row.get("fp_position"),
            enabled: row.get("fp_enabled"),
            properties: row.get::<Value, _>("fp_properties"),
            created_at: row.get("fp_created_at"),
            updated_at: row.get("fp_updated_at"),
            device: None,
            port_type: None,
            port_specification: None,
        }),
        Err(_) => None,
    }
}

fn map_to_port(row: &PgRow) -> Option<DevicePortEntity> {
    match row.try_get::<String, _>("tp_id") {
        Ok(id) => Some(DevicePortEntity {
            id,
            device_id: row.get("tp_device_id"),
            port_type_id: row.get("tp_port_type_id"),
            port_specification_id: row.get("tp_port_specification_id"),
            name: row.get("tp_name"),
            position: row.get("tp_position"),
            enabled: row.get("tp_enabled"),
            properties: row.get::<Value, _>("tp_properties"),
            created_at: row.get("tp_created_at"),
            updated_at: row.get("tp_updated_at"),
            device: None,
            port_type: None,
            port_specification: None,
        }),
        Err(_) => None,
    }
}

fn row_to_entity(row: &PgRow) -> DeviceConnectionEntity {
    DeviceConnectionEntity {
        id: row.get("id"),
        from_port_id: row.get("from_port_id"),
        to_port_id: row.get("to_port_id"),
        details: row.get::<Value, _>("details"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        from_port: map_from_port(row),
        to_port: map_to_port(row),
    }
}

pub async fn create<'a, E>(
    executor: E,
    entity: &DeviceConnectionEntity,
) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO device_connections (
                id,
                from_port_id,
                to_port_id,
                details,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.from_port_id)
    .bind(&entity.to_port_id)
    .bind(&entity.details)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

pub async fn update<'a, E>(
    executor: E,
    entity: &DeviceConnectionEntity,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            UPDATE device_connections
            SET
                from_port_id = $2,
                to_port_id = $3,
                details = $4,
                updated_at = $5
            WHERE id = $1
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.from_port_id)
    .bind(&entity.to_port_id)
    .bind(&entity.details)
    .bind(entity.updated_at)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn delete<'a, E>(executor: E, device_id: &str, id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            DELETE FROM device_connections dc
            USING device_ports fp
            WHERE dc.id = $1
              AND dc.from_port_id = fp.id
              AND fp.device_id = $2
        "#,
    )
    .bind(id)
    .bind(device_id)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn get_by_device_and_id<'a, E>(
    executor: E,
    device_id: &str,
    id: &str,
) -> Result<Option<DeviceConnectionEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT
                dc.id,
                dc.from_port_id,
                dc.to_port_id,
                dc.details,
                dc.created_at,
                dc.updated_at,
                fp.id AS fp_id,
                fp.device_id AS fp_device_id,
                fp.port_type_id AS fp_port_type_id,
                fp.port_specification_id AS fp_port_specification_id,
                fp.name AS fp_name,
                fp.position AS fp_position,
                fp.enabled AS fp_enabled,
                fp.properties AS fp_properties,
                fp.created_at AS fp_created_at,
                fp.updated_at AS fp_updated_at,
                tp.id AS tp_id,
                tp.device_id AS tp_device_id,
                tp.port_type_id AS tp_port_type_id,
                tp.port_specification_id AS tp_port_specification_id,
                tp.name AS tp_name,
                tp.position AS tp_position,
                tp.enabled AS tp_enabled,
                tp.properties AS tp_properties,
                tp.created_at AS tp_created_at,
                tp.updated_at AS tp_updated_at
                        FROM device_connections dc
                        JOIN device_ports fp ON fp.id = dc.from_port_id
                        JOIN device_ports tp ON tp.id = dc.to_port_id
                        WHERE dc.id = $2
                            AND (fp.device_id = $1 OR tp.device_id = $1)
        "#,
    )
    .bind(device_id)
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|r| row_to_entity(&r)))
}

pub async fn get_all_by_device<'a, E>(
    executor: E,
    device_id: &str,
) -> Result<Vec<DeviceConnectionEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            SELECT
                dc.id,
                dc.from_port_id,
                dc.to_port_id,
                dc.details,
                dc.created_at,
                dc.updated_at,
                fp.id AS fp_id,
                fp.device_id AS fp_device_id,
                fp.port_type_id AS fp_port_type_id,
                fp.port_specification_id AS fp_port_specification_id,
                fp.name AS fp_name,
                fp.position AS fp_position,
                fp.enabled AS fp_enabled,
                fp.properties AS fp_properties,
                fp.created_at AS fp_created_at,
                fp.updated_at AS fp_updated_at,
                tp.id AS tp_id,
                tp.device_id AS tp_device_id,
                tp.port_type_id AS tp_port_type_id,
                tp.port_specification_id AS tp_port_specification_id,
                tp.name AS tp_name,
                tp.position AS tp_position,
                tp.enabled AS tp_enabled,
                tp.properties AS tp_properties,
                tp.created_at AS tp_created_at,
                tp.updated_at AS tp_updated_at
            FROM device_connections dc
            JOIN device_ports fp ON fp.id = dc.from_port_id
            JOIN device_ports tp ON tp.id = dc.to_port_id
            WHERE fp.device_id = $1 OR tp.device_id = $1
            ORDER BY
                LOWER(CASE WHEN fp.device_id = $1 THEN fp.name ELSE tp.name END),
                LOWER(CASE WHEN fp.device_id = $1 THEN tp.name ELSE fp.name END)
        "#,
    )
    .bind(device_id)
    .fetch_all(executor)
    .await?;

    Ok(rows.iter().map(row_to_entity).collect())
}

pub async fn exists_by_ports<'a, E>(
    executor: E,
    from_port_id: &str,
    to_port_id: &str,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    if let Some(exclude_id) = exclude_id {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1
                    FROM device_connections
                    WHERE from_port_id = $1 AND to_port_id = $2 AND id <> $3
                )
            "#,
        )
        .bind(from_port_id)
        .bind(to_port_id)
        .bind(exclude_id)
        .fetch_one(executor)
        .await
    } else {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1
                    FROM device_connections
                    WHERE from_port_id = $1 AND to_port_id = $2
                )
            "#,
        )
        .bind(from_port_id)
        .bind(to_port_id)
        .fetch_one(executor)
        .await
    }
}
