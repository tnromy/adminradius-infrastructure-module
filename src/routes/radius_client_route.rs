use actix_web::web::{self, ServiceConfig};

use crate::controllers::radius_client_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    // RADIUS client related endpoints
    cfg.service(
        web::scope("/radius-client")
            .route("/vendors", web::get().to(controller::index_vendors)),
    );
}
