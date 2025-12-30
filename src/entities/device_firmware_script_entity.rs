use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceFirmwareScriptEntity {
    pub id: String,
    pub device_firmware_id: String,
    pub name: String,
    pub description: Option<String>,
    pub script_text: String,
    pub script_params: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

