#![allow(dead_code)]

pub mod branch_topology_route;
pub mod device_connection_route;
pub mod device_port_interface_route;
pub mod device_port_route;
pub mod device_port_specification_route;
pub mod device_route;
pub mod device_type_route;
pub mod openvpn_client_route;
pub mod openvpn_server_route;

use actix_web::web::ServiceConfig;

pub fn configure(cfg: &mut ServiceConfig) {
    device_port_specification_route::configure(cfg);
    device_port_interface_route::configure(cfg);
    device_type_route::configure(cfg);
    device_route::configure(cfg);
    device_port_route::configure(cfg);
    device_connection_route::configure(cfg);
    branch_topology_route::configure(cfg);
    openvpn_server_route::configure(cfg);
    openvpn_client_route::configure(cfg);
}
