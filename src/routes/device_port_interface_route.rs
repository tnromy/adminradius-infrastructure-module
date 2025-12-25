use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_port_interface_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    // Plural for list
    cfg.service(
        web::scope("/device-port-interfaces")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index)),
    );

    // Singular for create/show/update/delete
    cfg.service(
        web::scope("/device-port-interface")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::post().to(controller::store))
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::put().to(controller::update))
            .route("/{id}", web::delete().to(controller::destroy)),
    );
}
