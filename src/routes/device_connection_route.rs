use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_connection_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    // Plural for list
    cfg.service(
        web::scope("/device/{device_id}")
            .route("/connections", web::get().to(controller::index)),
    );

    // Singular for create/show/update/delete
    cfg.service(
        web::scope("/device/{device_id}")
            .route("/connection", web::post().to(controller::store))
            .route("/connection/{connection_id}", web::get().to(controller::show))
            .route("/connection/{connection_id}", web::put().to(controller::update))
            .route("/connection/{connection_id}", web::delete().to(controller::destroy)),
    );
}
