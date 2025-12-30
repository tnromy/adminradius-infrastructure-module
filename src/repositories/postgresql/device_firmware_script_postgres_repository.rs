use crate::entities::device_firmware_script_entity::DeviceFirmwareScriptEntity;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

fn row_to_entity(row: &PgRow) -> DeviceFirmwareScriptEntity {
    DeviceFirmwareScriptEntity {
        id: row.get("id"),
        device_firmware_id: row.get("device_firmware_id"),
        name: row.get("name"),
        description: row.get("description"),
        script_text: row.get("script_text"),
        script_params: row.get("script_params"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub async fn create<'a, E>(executor: E, entity: &DeviceFirmwareScriptEntity) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO device_firmware_scripts (id, device_firmware_id, name, description, script_text, script_params, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.device_firmware_id)
    .bind(&entity.name)
    .bind(&entity.description)
    .bind(&entity.script_text)
    .bind(&entity.script_params)
    .bind(entity.created_at)
    .bind(entity.updated_at)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

pub async fn update<'a, E>(
    executor: E,
    id: &str,
    name: &str,
    description: Option<&str>,
    script_text: &str,
    script_params: &serde_json::Value,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            UPDATE device_firmware_scripts
            SET name = $2, description = $3, script_text = $4, script_params = $5, updated_at = NOW()
            WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(script_text)
    .bind(script_params)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn get_by_id<'a, E>(
    executor: E,
    id: &str,
) -> Result<Option<DeviceFirmwareScriptEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, device_firmware_id, name, description, script_text, script_params, created_at, updated_at
            FROM device_firmware_scripts
            WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.map(|r| row_to_entity(&r)))
}

pub async fn get_all_by_firmware<'a, E>(
    executor: E,
    device_firmware_id: &str,
) -> Result<Vec<DeviceFirmwareScriptEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let rows = sqlx::query(
        r#"
            SELECT id, device_firmware_id, name, description, script_text, script_params, created_at, updated_at
            FROM device_firmware_scripts
            WHERE device_firmware_id = $1
            ORDER BY LOWER(name)
        "#,
    )
    .bind(device_firmware_id)
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
            DELETE FROM device_firmware_scripts
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
                SELECT 1 FROM device_firmware_scripts WHERE id = $1
            )
        "#,
    )
    .bind(id)
    .fetch_one(executor)
    .await
}

pub async fn name_exists_in_firmware<'a, E>(
    executor: E,
    device_firmware_id: &str,
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
                    SELECT 1 FROM device_firmware_scripts
                    WHERE device_firmware_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3
                )
            "#,
        )
        .bind(device_firmware_id)
        .bind(name)
        .bind(id)
        .fetch_one(executor)
        .await
    } else {
        sqlx::query_scalar::<_, bool>(
            r#"
                SELECT EXISTS (
                    SELECT 1 FROM device_firmware_scripts
                    WHERE device_firmware_id = $1 AND LOWER(name) = LOWER($2)
                )
            "#,
        )
        .bind(device_firmware_id)
        .bind(name)
        .fetch_one(executor)
        .await
    }
}
