use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiusVendorEntity {
    pub id: i32,
    pub name: String,
    pub version: String,
}
