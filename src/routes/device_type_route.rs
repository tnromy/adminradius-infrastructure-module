use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_type_controller as controller;

pub fn configure(cfg: &mut ServiceConfig) {
    // Plural for list
    cfg.service(web::scope("/device-types").route("", web::get().to(controller::index)));

    // Singular for create/show/update/delete
    cfg.service(
        web::scope("/device-type")
            .route("", web::post().to(controller::store))
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::put().to(controller::update))
            .route("/{id}", web::delete().to(controller::destroy)),
    );
}
