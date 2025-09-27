use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_connection_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/device/{device_id}/connections")
            .route(web::get().to(controller::index)),
    );

    cfg.service(
        web::resource("/device/{device_id}/connection")
            .route(web::post().to(controller::store)),
    );

    cfg.service(
        web::resource("/device/{device_id}/connection/{connection_id}")
            .route(web::get().to(controller::show))
            .route(web::put().to(controller::update))
            .route(web::delete().to(controller::destroy)),
    );
}
