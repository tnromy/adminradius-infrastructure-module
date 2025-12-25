use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_port_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/device/{device_id}/ports")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index)),
    );

    cfg.service(
        web::scope("/device/{device_id}/port")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::post().to(controller::store))
            .route("/{port_id}", web::get().to(controller::show))
            .route("/{port_id}", web::put().to(controller::update))
            .route("/{port_id}", web::delete().to(controller::destroy)),
    );
}
