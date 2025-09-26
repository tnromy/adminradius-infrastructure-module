use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_port_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/device/{device_id}")
            .route("/ports", web::get().to(controller::index))
            .route("/port", web::post().to(controller::store))
            .route("/port/{port_id}", web::get().to(controller::show))
            .route("/port/{port_id}", web::put().to(controller::update))
            .route("/port/{port_id}", web::delete().to(controller::destroy)),
    );
}
