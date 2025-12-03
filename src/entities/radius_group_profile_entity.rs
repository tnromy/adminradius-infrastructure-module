use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiusGroupProfileEntity {
    pub id: i32,
    pub name: String,
    pub vendor_id: i32,
}
