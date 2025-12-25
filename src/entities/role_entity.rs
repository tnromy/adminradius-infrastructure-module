use serde::{Deserialize, Serialize};

/// Role entity representing a single role
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoleEntity {
    pub name: String,
    pub display_name: String,
    pub level: i32,
}
