use crate::entities::openvpn_server_entity::OpenvpnServerEntity;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

fn row_to_entity(row: &PgRow) -> OpenvpnServerEntity {
    OpenvpnServerEntity {
        id: row.get("id"),
        name: row.get("name"),
        host: row.get("host"),
        port: row.get("port"),
        proto: row.get("proto"),
        cipher: row.get("cipher"),
        auth_algorithm: row.get("auth_algorithm"),
        tls_key_pem: row.get("tls_key_pem"),
        tls_key_mode: row.get("tls_key_mode"),
        ca_chain_pem: row.get("ca_chain_pem"),
        encrypted_private_key_pem: row.get("encrypted_private_key_pem"),
        remote_cert_tls_name: row.get("remote_cert_tls_name"),
        crl_distribution_point: row.get("crl_distribution_point"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub async fn create<'a, E>(executor: E, entity: &OpenvpnServerEntity) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO openvpn_servers (
                id, name, host, port, proto, cipher, auth_algorithm,
                tls_key_pem, tls_key_mode, ca_chain_pem, encrypted_private_key_pem,
                remote_cert_tls_name, crl_distribution_point,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.name)
    .bind(&entity.host)
    .bind(entity.port)
    .bind(&entity.proto)
    .bind(&entity.cipher)
    .bind(&entity.auth_algorithm)
    .bind(&entity.tls_key_pem)
    .bind(&entity.tls_key_mode)
    .bind(&entity.ca_chain_pem)
    .bind(&entity.encrypted_private_key_pem)
    .bind(&entity.remote_cert_tls_name)
    .bind(&entity.crl_distribution_point)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

pub async fn update<'a, E>(
    executor: E,
    id: &str,
    host: &str,
    port: i32,
    proto: &str,
    cipher: Option<&str>,
    auth_algorithm: &str,
    tls_key_pem: Option<&str>,
    tls_key_mode: Option<&str>,
    remote_cert_tls_name: &str,
    crl_distribution_point: Option<&str>,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            UPDATE openvpn_servers
            SET host = $2,
                port = $3,
                proto = $4,
                cipher = $5,
                auth_algorithm = $6,
                tls_key_pem = $7,
                tls_key_mode = $8,
                remote_cert_tls_name = $9,
                crl_distribution_point = $10
            WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(host)
    .bind(port)
    .bind(proto)
    .bind(cipher)
    .bind(auth_algorithm)
    .bind(tls_key_pem)
    .bind(tls_key_mode)
    .bind(remote_cert_tls_name)
    .bind(crl_distribution_point)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn get_by_id<'a, E>(
    executor: E,
    id: &str,
) -> Result<Option<OpenvpnServerEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, name, host, port, proto, cipher, auth_algorithm,
                   tls_key_pem, tls_key_mode, ca_chain_pem, encrypted_private_key_pem,
                   remote_cert_tls_name, crl_distribution_point,
                   created_at, updated_at
            FROM openvpn_servers
            WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|r| row_to_entity(&r)))
}

pub async fn get_all<'a, E>(executor: E) -> Result<Vec<OpenvpnServerEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            SELECT id, name, host, port, proto, cipher, auth_algorithm,
                   tls_key_pem, tls_key_mode, ca_chain_pem, encrypted_private_key_pem,
                   remote_cert_tls_name, crl_distribution_point,
                   created_at, updated_at
            FROM openvpn_servers
            ORDER BY LOWER(name)
        "#,
    )
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
            DELETE FROM openvpn_servers
            WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn exists<'a, E>(executor: E, id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    sqlx::query_scalar::<_, bool>(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM openvpn_servers WHERE id = $1
            )
        "#,
    )
    .bind(id)
    .fetch_one(executor)
    .await
}

pub async fn name_exists<'a, E>(
    executor: E,
    name: &str,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    if let Some(id) = exclude_id {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1 FROM openvpn_servers
                    WHERE LOWER(name) = LOWER($1) AND id <> $2
                )
            "#,
        )
        .bind(name)
        .bind(id)
        .fetch_one(executor)
        .await
    } else {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1 FROM openvpn_servers
                    WHERE LOWER(name) = LOWER($1)
                )
            "#,
        )
        .bind(name)
        .fetch_one(executor)
        .await
    }
}

pub async fn host_port_exists<'a, E>(
    executor: E,
    host: &str,
    port: i32,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    if let Some(id) = exclude_id {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1 FROM openvpn_servers
                    WHERE host = $1 AND port = $2 AND id <> $3
                )
            "#,
        )
        .bind(host)
        .bind(port)
        .bind(id)
        .fetch_one(executor)
        .await
    } else {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1 FROM openvpn_servers
                    WHERE host = $1 AND port = $2
                )
            "#,
        )
        .bind(host)
        .bind(port)
        .fetch_one(executor)
        .await
    }
}
