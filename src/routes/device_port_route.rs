use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_port_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/device/{device_id}/ports")
            .route(web::get().to(controller::index)),
    );

    cfg.service(
        web::resource("/device/{device_id}/port")
            .route(web::post().to(controller::store)),
    );

    cfg.service(
        web::resource("/device/{device_id}/port/{port_id}")
            .route(web::get().to(controller::show))
            .route(web::put().to(controller::update))
            .route(web::delete().to(controller::destroy)),
    );
}
