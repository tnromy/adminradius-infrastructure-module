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

    // Device OpenVPN Client assignment routes
    cfg.service(
        web::resource("/device/{device_id}/openvpn-client/{openvpn_client_id}")
            .route(web::put().to(controller::assign_openvpn_client))
            .route(web::delete().to(controller::unassign_openvpn_client)),
    );

    // Device Radius Client activation routes
    cfg.service(
        web::resource("/device/{device_id}/radius-client")
            .route(web::put().to(controller::activate_radius_client))
            .route(web::delete().to(controller::deactivate_radius_client)),
    );
}
