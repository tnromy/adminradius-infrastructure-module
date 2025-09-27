use actix_web::web::{self, ServiceConfig};

use crate::controllers::branch_topology_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/branch/{branch_id}/topologies")
            .route(web::get().to(controller::index)),
    );
}
