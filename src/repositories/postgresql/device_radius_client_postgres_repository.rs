use crate::entities::device_radius_client_entity::DeviceRadiusClientEntity;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

fn row_to_entity(row: &PgRow) -> DeviceRadiusClientEntity {
    DeviceRadiusClientEntity {
        id: row.get("id"),
        device_openvpn_client_id: row.get("device_openvpn_client_id"),
        radius_client_id: row.get("radius_client_id"),
        encrypted_secret: row.get("encrypted_secret"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Create a new device_radius_client assignment
pub async fn create<'a, E>(executor: E, entity: &DeviceRadiusClientEntity) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO device_radius_clients (
                id, device_openvpn_client_id, radius_client_id,
                encrypted_secret, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.device_openvpn_client_id)
    .bind(entity.radius_client_id)
    .bind(&entity.encrypted_secret)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

/// Find by device_openvpn_client_id
pub async fn find_by_device_openvpn_client_id<'a, E>(
    executor: E,
    device_openvpn_client_id: &str,
) -> Result<Option<DeviceRadiusClientEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, device_openvpn_client_id, radius_client_id,
                   encrypted_secret, created_at, updated_at
            FROM device_radius_clients
            WHERE device_openvpn_client_id = $1
        "#,
    )
    .bind(device_openvpn_client_id)
    .fetch_optional(executor)
    .await?;

    Ok(row.as_ref().map(row_to_entity))
}

/// Find by radius_client_id
pub async fn find_by_radius_client_id<'a, E>(
    executor: E,
    radius_client_id: i32,
) -> Result<Option<DeviceRadiusClientEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, device_openvpn_client_id, radius_client_id,
                   encrypted_secret, created_at, updated_at
            FROM device_radius_clients
            WHERE radius_client_id = $1
        "#,
    )
    .bind(radius_client_id)
    .fetch_optional(executor)
    .await?;

    Ok(row.as_ref().map(row_to_entity))
}

/// Delete by device_openvpn_client_id
pub async fn delete_by_device_openvpn_client_id<'a, E>(
    executor: E,
    device_openvpn_client_id: &str,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            DELETE FROM device_radius_clients
            WHERE device_openvpn_client_id = $1
        "#,
    )
    .bind(device_openvpn_client_id)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}
