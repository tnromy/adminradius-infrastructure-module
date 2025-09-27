use serde_json::Value;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

use crate::entities::device_entity::DeviceEntity;
use crate::entities::device_port_entity::DevicePortEntity;
use crate::entities::device_port_interface_entity::DevicePortInterfaceEntity;
use crate::entities::device_port_specification_entity::DevicePortSpecificationEntity;

fn row_to_entity(row: &PgRow) -> DevicePortEntity {
    let device = match row.try_get::<String, _>("d_id") {
        Ok(id) => Some(DeviceEntity {
            id,
            branch_id: row.get("d_branch_id"),
            name: row.get("d_name"),
            device_type_id: row.get("d_device_type_id"),
            latitude: row.get("d_latitude"),
            longitude: row.get("d_longitude"),
            location_details: row.get::<Value, _>("d_location_details"),
            specifications: row.get::<Value, _>("d_specifications"),
            created_at: row.get("d_created_at"),
            updated_at: row.get("d_updated_at"),
            device_type: None,
        }),
        Err(_) => None,
    };

    let port_interface = match row.try_get::<String, _>("dpi_id") {
        Ok(id) => Some(DevicePortInterfaceEntity {
            id,
            name: row.get("dpi_name"),
            created_at: row.get("dpi_created_at"),
            updated_at: row.get("dpi_updated_at"),
        }),
        Err(_) => None,
    };

    let port_specification = match row.try_get::<String, _>("dps_id") {
        Ok(id) => Some(DevicePortSpecificationEntity {
            id,
            name: row.get("dps_name"),
            data: row.get::<Value, _>("dps_data"),
            created_at: row.get("dps_created_at"),
            updated_at: row.get("dps_updated_at"),
        }),
        Err(_) => None,
    };

    DevicePortEntity {
        id: row.get("id"),
        device_id: row.get("device_id"),
        port_interface_id: row.get("port_interface_id"),
        port_specification_id: row.get("port_specification_id"),
        name: row.get("name"),
        position: row.get("position"),
        enabled: row.get("enabled"),
        properties: row.get::<Value, _>("properties"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        device,
        port_interface,
        port_specification,
    }
}

pub async fn create<'a, E>(executor: E, entity: &DevicePortEntity) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO device_ports (
                id,
                device_id,
                port_interface_id,
                port_specification_id,
                name,
                position,
                enabled,
                properties,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.device_id)
    .bind(&entity.port_interface_id)
    .bind(&entity.port_specification_id)
    .bind(&entity.name)
    .bind(entity.position)
    .bind(entity.enabled)
    .bind(&entity.properties)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

pub async fn get_by_id<'a, E>(
    executor: E,
    id: &str,
) -> Result<Option<DevicePortEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT
                dp.id,
                dp.device_id,
                dp.port_interface_id,
                dp.port_specification_id,
                dp.name,
                dp.position,
                dp.enabled,
                dp.properties,
                dp.created_at,
                dp.updated_at,
                d.id AS d_id,
                d.branch_id AS d_branch_id,
                d.name AS d_name,
                d.device_type_id AS d_device_type_id,
                d.latitude AS d_latitude,
                d.longitude AS d_longitude,
                d.location_details AS d_location_details,
                d.specifications AS d_specifications,
                d.created_at AS d_created_at,
                d.updated_at AS d_updated_at,
                dpi.id AS dpi_id,
                dpi.name AS dpi_name,
                dpi.created_at AS dpi_created_at,
                dpi.updated_at AS dpi_updated_at,
                dps.id AS dps_id,
                dps.name AS dps_name,
                dps.data AS dps_data,
                dps.created_at AS dps_created_at,
                dps.updated_at AS dps_updated_at
            FROM device_ports dp
            LEFT JOIN devices d ON d.id = dp.device_id
            LEFT JOIN device_port_interfaces dpi ON dpi.id = dp.port_interface_id
            LEFT JOIN device_port_specifications dps ON dps.id = dp.port_specification_id
            WHERE dp.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|r| row_to_entity(&r)))
}

pub async fn update<'a, E>(executor: E, entity: &DevicePortEntity) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            UPDATE device_ports
            SET
                port_interface_id = $2,
                port_specification_id = $3,
                name = $4,
                position = $5,
                enabled = $6,
                properties = $7,
                updated_at = $8
            WHERE id = $1 AND device_id = $9
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.port_interface_id)
    .bind(&entity.port_specification_id)
    .bind(&entity.name)
    .bind(entity.position)
    .bind(entity.enabled)
    .bind(&entity.properties)
    .bind(entity.updated_at)
    .bind(&entity.device_id)
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
            DELETE FROM device_ports
            WHERE id = $1 AND device_id = $2
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
) -> Result<Option<DevicePortEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT
                dp.id,
                dp.device_id,
                dp.port_interface_id,
                dp.port_specification_id,
                dp.name,
                dp.position,
                dp.enabled,
                dp.properties,
                dp.created_at,
                dp.updated_at,
                d.id AS d_id,
                d.branch_id AS d_branch_id,
                d.name AS d_name,
                d.device_type_id AS d_device_type_id,
                d.latitude AS d_latitude,
                d.longitude AS d_longitude,
                d.location_details AS d_location_details,
                d.specifications AS d_specifications,
                d.created_at AS d_created_at,
                d.updated_at AS d_updated_at,
                dpi.id AS dpi_id,
                dpi.name AS dpi_name,
                dpi.created_at AS dpi_created_at,
                dpi.updated_at AS dpi_updated_at,
                dps.id AS dps_id,
                dps.name AS dps_name,
                dps.data AS dps_data,
                dps.created_at AS dps_created_at,
                dps.updated_at AS dps_updated_at
            FROM device_ports dp
            LEFT JOIN devices d ON d.id = dp.device_id
            LEFT JOIN device_port_interfaces dpi ON dpi.id = dp.port_interface_id
            LEFT JOIN device_port_specifications dps ON dps.id = dp.port_specification_id
            WHERE dp.device_id = $1 AND dp.id = $2
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
) -> Result<Vec<DevicePortEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            SELECT
                dp.id,
                dp.device_id,
                dp.port_interface_id,
                dp.port_specification_id,
                dp.name,
                dp.position,
                dp.enabled,
                dp.properties,
                dp.created_at,
                dp.updated_at,
                d.id AS d_id,
                d.branch_id AS d_branch_id,
                d.name AS d_name,
                d.device_type_id AS d_device_type_id,
                d.latitude AS d_latitude,
                d.longitude AS d_longitude,
                d.location_details AS d_location_details,
                d.specifications AS d_specifications,
                d.created_at AS d_created_at,
                d.updated_at AS d_updated_at,
                dpi.id AS dpi_id,
                dpi.name AS dpi_name,
                dpi.created_at AS dpi_created_at,
                dpi.updated_at AS dpi_updated_at,
                dps.id AS dps_id,
                dps.name AS dps_name,
                dps.data AS dps_data,
                dps.created_at AS dps_created_at,
                dps.updated_at AS dps_updated_at
            FROM device_ports dp
            LEFT JOIN devices d ON d.id = dp.device_id
            LEFT JOIN device_port_interfaces dpi ON dpi.id = dp.port_interface_id
            LEFT JOIN device_port_specifications dps ON dps.id = dp.port_specification_id
            WHERE dp.device_id = $1
            ORDER BY COALESCE(dp.position, 2147483647), LOWER(dp.name)
        "#,
    )
    .bind(device_id)
    .fetch_all(executor)
    .await?;

    Ok(rows.iter().map(row_to_entity).collect())
}

pub async fn name_exists<'a, E>(
    executor: E,
    device_id: &str,
    name: &str,
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
                    FROM device_ports
                    WHERE device_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3
                )
            "#,
        )
        .bind(device_id)
        .bind(name)
        .bind(exclude_id)
        .fetch_one(executor)
        .await
    } else {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1
                    FROM device_ports
                    WHERE device_id = $1 AND LOWER(name) = LOWER($2)
                )
            "#,
        )
        .bind(device_id)
        .bind(name)
        .fetch_one(executor)
        .await
    }
}

pub async fn exists<'a, E>(executor: E, id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    sqlx::query_scalar::<_, bool>(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM device_ports WHERE id = $1
            )
        "#,
    )
    .bind(id)
    .fetch_one(executor)
    .await
}
