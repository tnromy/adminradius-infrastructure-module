use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/branch/{branch_id}/devices")
            .route(web::get().to(controller::index)),
    );

    cfg.service(
        web::resource("/branch/{branch_id}/device")
            .route(web::post().to(controller::store)),
    );

    cfg.service(
        web::resource("/branch/{branch_id}/device/{device_id}")
            .route(web::get().to(controller::show))
            .route(web::put().to(controller::update))
            .route(web::delete().to(controller::destroy)),
    );
}
