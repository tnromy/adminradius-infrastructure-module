use std::collections::{HashMap, HashSet};

use crate::entities::device_entity::DeviceEntity;
use crate::entities::device_port_entity::DevicePortEntity;
use crate::infrastructures::database::DatabaseConnection;
use crate::repositories::postgresql::device_topology_postgres_repository::get_branch_topology as fetch_branch_topology;
use crate::repositories::postgresql::device_port_postgres_repository;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BranchTopologyDevicePort {
    pub id: String,
    pub device_id: String,
    pub port_interface_id: String,
    pub port_specification_id: Option<String>,
    pub name: String,
    pub position: Option<i32>,
    pub enabled: bool,
    pub properties: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<DevicePortEntity> for BranchTopologyDevicePort {
    fn from(port: DevicePortEntity) -> Self {
        Self {
            id: port.id,
            device_id: port.device_id,
            port_interface_id: port.port_interface_id,
            port_specification_id: port.port_specification_id,
            name: port.name,
            position: port.position,
            enabled: port.enabled,
            properties: port.properties,
            created_at: port.created_at,
            updated_at: port.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BranchTopologyDevice {
    #[serde(flatten)]
    data: DeviceEntity,
    pub device_ports: Vec<BranchTopologyDevicePort>,
}

impl BranchTopologyDevice {
    fn new(device: DeviceEntity, device_ports: Vec<BranchTopologyDevicePort>) -> Self {
        Self { data: device, device_ports }
    }
}

#[derive(Debug, Serialize)]
pub struct BranchTopologyNode {
    pub device: BranchTopologyDevice,
    pub parent_device_port_id: Option<String>,
    pub connection_id: Option<String>,
    pub connection_details: Option<serde_json::Value>,
    pub level: i32,
}

pub async fn execute(
    db: &DatabaseConnection,
    branch_id: &str,
    limit_level: Option<i32>,
) -> Result<Vec<BranchTopologyNode>, sqlx::Error> {
    let pool = db.get_pool();
    let nodes = fetch_branch_topology(pool.as_ref(), branch_id, limit_level).await?;

    let mut device_ids: HashSet<String> = HashSet::new();
    for node in &nodes {
        device_ids.insert(node.device.id.clone());
    }

    let mut device_ports_map: HashMap<String, Vec<BranchTopologyDevicePort>> = HashMap::new();
    for device_id in device_ids {
        let ports = device_port_postgres_repository::get_all_by_device(pool.as_ref(), &device_id)
            .await?
            .into_iter()
            .map(BranchTopologyDevicePort::from)
            .collect();
        device_ports_map.insert(device_id, ports);
    }

    Ok(nodes
        .into_iter()
        .map(|node| {
            let device_id = node.device.id.clone();
            let device_ports = device_ports_map.remove(&device_id).unwrap_or_default();
            BranchTopologyNode {
                device: BranchTopologyDevice::new(node.device, device_ports),
                parent_device_port_id: node.parent_device_port_id,
                connection_id: node.connection_id,
                connection_details: node.connection_details,
                level: node.level,
            }
        })
        .collect())
}
