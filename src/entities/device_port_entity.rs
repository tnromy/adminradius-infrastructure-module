use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::entities::device_entity::DeviceEntity;
use crate::entities::device_port_interface_entity::DevicePortInterfaceEntity;
use crate::entities::device_port_specification_entity::DevicePortSpecificationEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevicePortEntity {
    pub id: String,
    pub device_id: String,
    pub port_type_id: String,
    pub port_specification_id: Option<String>,
    pub name: String,
    pub position: Option<i32>,
    pub enabled: bool,
    pub properties: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub device: Option<DeviceEntity>,
    pub port_type: Option<DevicePortInterfaceEntity>,
    pub port_specification: Option<DevicePortSpecificationEntity>,
}
