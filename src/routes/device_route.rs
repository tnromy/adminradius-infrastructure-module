use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    // Plural for list
    cfg.service(
        web::scope("/branch/{branch_id}")
            .route("/devices", web::get().to(controller::index)),
    );

    // Singular for create/show/update/delete
    cfg.service(
        web::scope("/branch/{branch_id}")
            .route("/device", web::post().to(controller::store))
            .route("/device/{device_id}", web::get().to(controller::show))
            .route("/device/{device_id}", web::put().to(controller::update))
            .route("/device/{device_id}", web::delete().to(controller::destroy)),
    );
}
