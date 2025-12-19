use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

use crate::entities::device_entity::DeviceEntity;
use crate::entities::device_type_entity::DeviceTypeEntity;

fn row_to_device(row: &PgRow) -> DeviceEntity {
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
        id: row.get("id"),
        branch_id: row.get("branch_id"),
        name: row.get("name"),
        device_type_id: row.get("device_type_id"),
        latitude: row.get("latitude"),
        longitude: row.get("longitude"),
        location_details: row.get::<Value, _>("location_details"),
        specifications: row.get::<Value, _>("specifications"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        device_type,
    }
}

pub async fn create<'a, E>(executor: E, entity: &DeviceEntity) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO devices (
                id,
                branch_id,
                name,
                device_type_id,
                latitude,
                longitude,
                location_details,
                specifications,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.branch_id)
    .bind(&entity.name)
    .bind(&entity.device_type_id)
    .bind(entity.latitude)
    .bind(entity.longitude)
    .bind(&entity.location_details)
    .bind(&entity.specifications)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

pub async fn update<'a, E>(executor: E, entity: &DeviceEntity) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            UPDATE devices
            SET
                branch_id = $2,
                name = $3,
                device_type_id = $4,
                latitude = $5,
                longitude = $6,
                location_details = $7,
                specifications = $8,
                updated_at = $9
            WHERE id = $1
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.branch_id)
    .bind(&entity.name)
    .bind(&entity.device_type_id)
    .bind(entity.latitude)
    .bind(entity.longitude)
    .bind(&entity.location_details)
    .bind(&entity.specifications)
    .bind(entity.updated_at)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn delete<'a, E>(executor: E, id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            DELETE FROM devices
            WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn get_by_id<'a, E>(executor: E, id: &str) -> Result<Option<DeviceEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT
                d.id,
                d.branch_id,
                d.name,
                d.device_type_id,
                d.latitude,
                d.longitude,
                d.location_details,
                d.specifications,
                d.created_at,
                d.updated_at,
                dt.id AS dt_id,
                dt.name AS dt_name,
                dt.created_at AS dt_created_at,
                dt.updated_at AS dt_updated_at
            FROM devices d
            LEFT JOIN device_types dt ON dt.id = d.device_type_id
            WHERE d.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|r| row_to_device(&r)))
}

pub async fn get_by_branch_and_id<'a, E>(
    executor: E,
    branch_id: &str,
    id: &str,
) -> Result<Option<DeviceEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT
                d.id,
                d.branch_id,
                d.name,
                d.device_type_id,
                d.latitude,
                d.longitude,
                d.location_details,
                d.specifications,
                d.created_at,
                d.updated_at,
                dt.id AS dt_id,
                dt.name AS dt_name,
                dt.created_at AS dt_created_at,
                dt.updated_at AS dt_updated_at
            FROM devices d
            LEFT JOIN device_types dt ON dt.id = d.device_type_id
            WHERE d.id = $1 AND d.branch_id = $2
        "#,
    )
    .bind(id)
    .bind(branch_id)
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|r| row_to_device(&r)))
}

pub async fn get_all_by_branch<'a, E>(
    executor: E,
    branch_id: &str,
) -> Result<Vec<DeviceEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            SELECT
                d.id,
                d.branch_id,
                d.name,
                d.device_type_id,
                d.latitude,
                d.longitude,
                d.location_details,
                d.specifications,
                d.created_at,
                d.updated_at,
                dt.id AS dt_id,
                dt.name AS dt_name,
                dt.created_at AS dt_created_at,
                dt.updated_at AS dt_updated_at
            FROM devices d
            LEFT JOIN device_types dt ON dt.id = d.device_type_id
            WHERE d.branch_id = $1
            ORDER BY LOWER(d.name)
        "#,
    )
    .bind(branch_id)
    .fetch_all(executor)
    .await?;

    Ok(rows.iter().map(row_to_device).collect())
}

pub async fn exists<'a, E>(executor: E, id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    sqlx::query_scalar::<_, bool>(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM devices WHERE id = $1
            )
        "#,
    )
    .bind(id)
    .fetch_one(executor)
    .await
}

/// Check if a device exists and its device_type.name is 'Router'
pub async fn is_device_router<'a, E>(executor: E, device_id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    sqlx::query_scalar::<_, bool>(
        r#"
            SELECT EXISTS (
                SELECT 1
                FROM devices d
                JOIN device_types dt ON d.device_type_id = dt.id
                WHERE d.id = $1 AND dt.name = 'Router'
            )
        "#,
    )
    .bind(device_id)
    .fetch_one(executor)
    .await
}

