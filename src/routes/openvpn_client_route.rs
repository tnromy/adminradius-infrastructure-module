use actix_web::web::{self, ServiceConfig};

use crate::controllers::openvpn_client_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    // Singular for show/delete
    cfg.service(
        web::scope("/openvpn-client")
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::delete().to(controller::destroy)),
    );
}
