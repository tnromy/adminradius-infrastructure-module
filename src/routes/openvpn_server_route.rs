use actix_web::web::{self, ServiceConfig};

use crate::controllers::openvpn_client_controller as client_controller;
use crate::controllers::openvpn_server_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    // Plural for list
    cfg.service(
        web::scope("/openvpn-servers")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index)),
    );

    // Singular for create/show/update/delete
    cfg.service(
        web::scope("/openvpn-server")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::post().to(controller::store))
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::put().to(controller::update))
            .route("/{id}", web::delete().to(controller::destroy))
            // Client routes scoped under server
            .route("/{openvpn_server_id}/client", web::post().to(client_controller::store))
            .route("/{openvpn_server_id}/clients", web::get().to(client_controller::index)),
    );
}
