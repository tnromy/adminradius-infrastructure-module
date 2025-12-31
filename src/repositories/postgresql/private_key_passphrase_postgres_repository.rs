use crate::entities::private_key_passphrase_entity::PrivateKeyPassphraseEntity;
use sqlx::{Executor, Postgres, Row, postgres::PgRow};

fn row_to_entity(row: &PgRow) -> PrivateKeyPassphraseEntity {
    PrivateKeyPassphraseEntity {
        id: row.get("id"),
        private_key_hash: row.get("private_key_hash"),
        encrypted_passphrase: row.get("encrypted_passphrase"),
    }
}

/// Create a new private key passphrase record
pub async fn create<'a, E>(
    executor: E,
    entity: &PrivateKeyPassphraseEntity,
) -> Result<String, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row: PgRow = sqlx::query(
        r#"
            INSERT INTO private_keys_passphrases (id, private_key_hash, encrypted_passphrase)
            VALUES ($1, $2, $3)
            RETURNING id
        "#,
    )
    .bind(&entity.id)
    .bind(&entity.private_key_hash)
    .bind(&entity.encrypted_passphrase)
    .fetch_one(executor)
    .await?;

    Ok(row.get("id"))
}

/// Find a private key passphrase by its hash
pub async fn find_by_hash<'a, E>(
    executor: E,
    private_key_hash: &str,
) -> Result<Option<PrivateKeyPassphraseEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, private_key_hash, encrypted_passphrase
            FROM private_keys_passphrases
            WHERE private_key_hash = $1
        "#,
    )
    .bind(private_key_hash)
    .fetch_optional(executor)
    .await?;

    Ok(row.as_ref().map(row_to_entity))
}

/// Find a private key passphrase by ID
pub async fn find_by_id<'a, E>(
    executor: E,
    id: &str,
) -> Result<Option<PrivateKeyPassphraseEntity>, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let row = sqlx::query(
        r#"
            SELECT id, private_key_hash, encrypted_passphrase
            FROM private_keys_passphrases
            WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?;

    Ok(row.as_ref().map(row_to_entity))
}

/// Delete a private key passphrase by its hash
pub async fn delete_by_hash<'a, E>(executor: E, private_key_hash: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            DELETE FROM private_keys_passphrases
            WHERE private_key_hash = $1
        "#,
    )
    .bind(private_key_hash)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Delete a private key passphrase by ID
pub async fn delete_by_id<'a, E>(executor: E, id: &str) -> Result<bool, sqlx::Error>
where
    E: Executor<'a, Database = Postgres>,
{
    let result = sqlx::query(
        r#"
            DELETE FROM private_keys_passphrases
            WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(executor)
    .await?;

    Ok(result.rows_affected() > 0)
}
