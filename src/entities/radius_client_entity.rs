use serde::{Deserialize, Serialize};

use crate::entities::radius_vendor_entity::RadiusVendorEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiusClientEntity {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub host: String,
    pub secret: String,
    pub vendor_id: i32,
    pub vendor: RadiusVendorEntity,
}
