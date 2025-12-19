use crate::entities::openvpn_client_entity::OpenvpnClientEntity;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

fn row_to_entity(row: &PgRow) -> OpenvpnClientEntity {
    OpenvpnClientEntity {
        id: row.get("id"),
        server_id: row.get("server_id"),
        cn: row.get("cn"),
        reserved_ip_address: row.get("reserved_ip_address"),
        certificate_pem: row.get("certificate_pem"),
        encrypted_private_key_pem: row.get("encrypted_private_key_pem"),
        revoked_at: row.get("revoked_at"),
        expired_at: row.get("expired_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub async fn create<'a, E>(executor: E, entity: &OpenvpnClientEntity) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO openvpn_clients (
                id, server_id, cn, reserved_ip_address,
                certificate_pem, encrypted_private_key_pem,
                revoked_at, expired_at,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.server_id)
    .bind(&entity.cn)
    .bind(&entity.reserved_ip_address)
    .bind(&entity.certificate_pem)
    .bind(&entity.encrypted_private_key_pem)
    .bind(entity.revoked_at)
    .bind(entity.expired_at)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

pub async fn find_by_id<'a, E>(executor: E, id: &str) -> Result<Option<OpenvpnClientEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, server_id, cn, reserved_ip_address,
                   certificate_pem, encrypted_private_key_pem,
                   revoked_at, expired_at, created_at, updated_at
            FROM openvpn_clients
            WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.as_ref().map(row_to_entity))
}

pub async fn find_by_server_id<'a, E>(
    executor: E,
    server_id: &str,
) -> Result<Vec<OpenvpnClientEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            SELECT id, server_id, cn, reserved_ip_address,
                   certificate_pem, encrypted_private_key_pem,
                   revoked_at, expired_at, created_at, updated_at
            FROM openvpn_clients
            WHERE server_id = $1
            ORDER BY created_at DESC
        "#,
    )
    .bind(server_id)
    .fetch_all(executor)
    .await?;

    Ok(rows.iter().map(row_to_entity).collect())
}

pub async fn delete<'a, E>(executor: E, id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            DELETE FROM openvpn_clients
            WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Check if a CN already exists for a specific server
pub async fn cn_exists_for_server<'a, E>(
    executor: E,
    server_id: &str,
    cn: &str,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let query = match exclude_id {
        Some(exc_id) => {
            sqlx::query(
                r#"
                    SELECT COUNT(*) as count
                    FROM openvpn_clients
                    WHERE server_id = $1 AND cn = $2 AND id != $3
                "#,
            )
            .bind(server_id)
            .bind(cn)
            .bind(exc_id)
        }
        None => {
            sqlx::query(
                r#"
                    SELECT COUNT(*) as count
                    FROM openvpn_clients
                    WHERE server_id = $1 AND cn = $2
                "#,
            )
            .bind(server_id)
            .bind(cn)
        }
    };

    let row = query.fetch_one(executor).await?;
    let count: i64 = row.get("count");
    Ok(count > 0)
}
