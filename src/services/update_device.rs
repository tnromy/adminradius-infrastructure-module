use chrono::Utc;
use serde_json::Value;
use thiserror::Error;

use crate::entities::device_entity::DeviceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_postgres_repository as device_repository;
use crate::repositories::postgresql::device_type_postgres_repository as device_type_repository;

#[derive(Debug)]
pub struct UpdateDeviceInput {
    pub id: String,
    pub branch_id: String,
    pub name: String,
    pub device_type_id: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location_details: Value,
    pub specifications: Value,
}

#[derive(Debug, Error)]
pub enum UpdateDeviceError {
    #[error("device not found")]
    NotFound,
    #[error("device type not found")]
    DeviceTypeNotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: UpdateDeviceInput,
) -> Result<DeviceEntity, UpdateDeviceError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if !device_type_repository::exists(conn, &input.device_type_id).await? {
        return Err(UpdateDeviceError::DeviceTypeNotFound);
    }

    let Some(existing) =
        device_repository::get_by_branch_and_id(conn, &input.branch_id, &input.id).await?
    else {
        return Err(UpdateDeviceError::NotFound);
    };

    let updated_entity = DeviceEntity {
        id: existing.id,
        branch_id: input.branch_id,
        name: input.name,
        device_type_id: input.device_type_id,
        latitude: input.latitude,
        longitude: input.longitude,
        location_details: input.location_details,
        specifications: input.specifications,
        created_at: existing.created_at,
        updated_at: Utc::now(),
        device_type: None,
    };

    device_repository::update(conn, &updated_entity).await?;

    let refreshed = device_repository::get_by_id(conn, &updated_entity.id).await?;
    Ok(refreshed.unwrap_or(updated_entity))
}
