use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::entities::device_port_entity::DevicePortEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConnectionEntity {
    pub id: String,
    pub from_port_id: String,
    pub to_port_id: String,
    pub details: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub from_port: Option<DevicePortEntity>,
    pub to_port: Option<DevicePortEntity>,
}
