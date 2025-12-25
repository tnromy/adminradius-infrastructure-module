use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;
use crate::middlewares::branch_access_middleware::BranchAccessMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/branch/{branch_id}/devices")
            .wrap(BranchAccessMiddleware)
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index)),
    );

    cfg.service(
        web::scope("/branch/{branch_id}/device")
            .wrap(BranchAccessMiddleware)
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::post().to(controller::store))
            .route("/{device_id}", web::get().to(controller::show))
            .route("/{device_id}", web::put().to(controller::update))
            .route("/{device_id}", web::delete().to(controller::destroy)),
    );

    // Device OpenVPN Client assignment routes
    cfg.service(
        web::scope("/device/{device_id}/openvpn-client")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("/{openvpn_client_id}", web::put().to(controller::assign_openvpn_client))
            .route("/{openvpn_client_id}", web::delete().to(controller::unassign_openvpn_client)),
    );

    // Device Radius Client activation routes
    cfg.service(
        web::scope("/device/{device_id}/radius-client")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::put().to(controller::activate_radius_client))
            .route("", web::delete().to(controller::deactivate_radius_client)),
    );
}
