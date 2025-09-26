use chrono::Utc;
use serde_json::Value;
use thiserror::Error;

use crate::entities::device_entity::DeviceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_postgres_repository as device_repository;
use crate::repositories::postgresql::device_type_postgres_repository as device_type_repository;
use crate::utils::uuid_helper;

#[derive(Debug)]
pub struct AddDeviceInput {
    pub branch_id: String,
    pub name: String,
    pub device_type_id: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location_details: Value,
    pub specifications: Value,
}

#[derive(Debug, Error)]
pub enum AddDeviceError {
    #[error("device type not found")]
    DeviceTypeNotFound,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn execute(
    db: &DatabaseConnection,
    input: AddDeviceInput,
) -> Result<DeviceEntity, AddDeviceError> {
    let pool = db.get_pool();
    let conn = pool.as_ref();

    if !device_type_repository::exists(conn, &input.device_type_id).await? {
        return Err(AddDeviceError::DeviceTypeNotFound);
    }

    let now = Utc::now();
    let entity = DeviceEntity {
        id: uuid_helper::generate(),
        branch_id: input.branch_id,
        name: input.name,
        device_type_id: input.device_type_id,
        latitude: input.latitude,
        longitude: input.longitude,
        location_details: input.location_details,
        specifications: input.specifications,
        created_at: now,
        updated_at: now,
        device_type: None,
    };

    device_repository::create(conn, &entity).await?;

    let created = device_repository::get_by_id(conn, &entity.id).await?;
    Ok(created.unwrap_or(entity))
}
