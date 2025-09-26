use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::entities::device_type_entity::DeviceTypeEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceEntity {
    pub id: String,
    pub branch_id: String,
    pub name: String,
    pub device_type_id: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location_details: Value,
    pub specifications: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub device_type: Option<DeviceTypeEntity>,
}
