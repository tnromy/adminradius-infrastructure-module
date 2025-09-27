use crate::entities::device_entity::DeviceEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_topology_postgres_repository::{
    get_branch_topology as fetch_branch_topology,
    DeviceTopologyNode,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BranchTopologyNode {
    pub device: DeviceEntity,
    pub parent_device_id: Option<String>,
    pub connection_id: Option<String>,
    pub connection_details: Option<serde_json::Value>,
    pub level: i32,
}

impl From<DeviceTopologyNode> for BranchTopologyNode {
    fn from(node: DeviceTopologyNode) -> Self {
        Self {
            device: node.device,
            parent_device_id: node.parent_device_id,
            connection_id: node.connection_id,
            connection_details: node.connection_details,
            level: node.level,
        }
    }
}

pub async fn execute(
    db: &DatabaseConnection,
    branch_id: &str,
    limit_level: Option<i32>,
) -> Result<Vec<BranchTopologyNode>, sqlx::Error> {
    let pool = db.get_pool();
    let nodes = fetch_branch_topology(pool.as_ref(), branch_id, limit_level).await?;
    Ok(nodes.into_iter().map(BranchTopologyNode::from).collect())
}
