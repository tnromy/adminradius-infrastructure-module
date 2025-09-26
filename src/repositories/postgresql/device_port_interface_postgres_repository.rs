use crate::entities::device_port_interface_entity::DevicePortInterfaceEntity;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

fn row_to_entity(row: &PgRow) -> DevicePortInterfaceEntity {
    DevicePortInterfaceEntity {
        id: row.get("id"),
        name: row.get("name"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub async fn create<'a, E>(
    executor: E,
    entity: &DevicePortInterfaceEntity,
) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO device_port_interfaces (id, name, created_at, updated_at)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.name)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

pub async fn update<'a, E>(executor: E, id: &str, name: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            UPDATE device_port_interfaces
            SET name = $2
            WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(name)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn get_by_id<'a, E>(
    executor: E,
    id: &str,
) -> Result<Option<DevicePortInterfaceEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, name, created_at, updated_at
            FROM device_port_interfaces
            WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|r| row_to_entity(&r)))
}

pub async fn get_all<'a, E>(executor: E) -> Result<Vec<DevicePortInterfaceEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            SELECT id, name, created_at, updated_at
            FROM device_port_interfaces
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
            DELETE FROM device_port_interfaces
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
                SELECT 1 FROM device_port_interfaces WHERE id = $1
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
                    SELECT 1 FROM device_port_interfaces
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
                    SELECT 1 FROM device_port_interfaces
                    WHERE LOWER(name) = LOWER($1)
                )
            "#,
        )
        .bind(name)
        .fetch_one(executor)
        .await
    }
}
