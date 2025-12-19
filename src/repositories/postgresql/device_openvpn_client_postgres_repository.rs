use crate::entities::device_openvpn_client_entity::DeviceOpenvpnClientEntity;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

fn row_to_entity(row: &PgRow) -> DeviceOpenvpnClientEntity {
    DeviceOpenvpnClientEntity {
        id: row.get("id"),
        device_id: row.get("device_id"),
        openvpn_client_id: row.get("openvpn_client_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Create a new device-openvpn_client assignment
pub async fn create<'a, E>(executor: E, entity: &DeviceOpenvpnClientEntity) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO device_openvpn_clients (
                id, device_id, openvpn_client_id,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.device_id)
    .bind(&entity.openvpn_client_id)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

/// Find assignment by device_id
pub async fn find_by_device_id<'a, E>(
    executor: E,
    device_id: &str,
) -> Result<Option<DeviceOpenvpnClientEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, device_id, openvpn_client_id, created_at, updated_at
            FROM device_openvpn_clients
            WHERE device_id = $1
        "#,
    )
    .bind(device_id)
    .fetch_optional(executor)
    .await?;

    Ok(row.as_ref().map(row_to_entity))
}

/// Find assignment by openvpn_client_id
pub async fn find_by_openvpn_client_id<'a, E>(
    executor: E,
    openvpn_client_id: &str,
) -> Result<Option<DeviceOpenvpnClientEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, device_id, openvpn_client_id, created_at, updated_at
            FROM device_openvpn_clients
            WHERE openvpn_client_id = $1
        "#,
    )
    .bind(openvpn_client_id)
    .fetch_optional(executor)
    .await?;

    Ok(row.as_ref().map(row_to_entity))
}

/// Check if a specific assignment exists
pub async fn exists<'a, E>(
    executor: E,
    device_id: &str,
    openvpn_client_id: &str,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT COUNT(*) as count
            FROM device_openvpn_clients
            WHERE device_id = $1 AND openvpn_client_id = $2
        "#,
    )
    .bind(device_id)
    .bind(openvpn_client_id)
    .fetch_one(executor)
    .await?;

    let count: i64 = row.get("count");
    Ok(count > 0)
}

/// Delete assignment by device_id and openvpn_client_id
pub async fn delete_by_device_and_client<'a, E>(
    executor: E,
    device_id: &str,
    openvpn_client_id: &str,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            DELETE FROM device_openvpn_clients
            WHERE device_id = $1 AND openvpn_client_id = $2
        "#,
    )
    .bind(device_id)
    .bind(openvpn_client_id)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}
