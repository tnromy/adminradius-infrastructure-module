use actix_web::web::{self, ServiceConfig};

use crate::controllers::openvpn_client_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    // Singular for show/delete
    cfg.service(
        web::scope("/openvpn-client")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::delete().to(controller::destroy)),
    );
}
