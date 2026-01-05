use actix_web::web::{self, ServiceConfig};

use crate::controllers::device_firmware_controller as controller;
use crate::controllers::device_firmware_script_controller as script_controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    // Plural for list
    cfg.service(
        web::scope("/device-firmwares")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index)),
    );

    // Singular for create/show/update/delete + nested scripts (list/create only)
    cfg.service(
        web::scope("/device-firmware")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::post().to(controller::store))
            .route("/{id}", web::get().to(controller::show))
            .route("/{id}", web::put().to(controller::update))
            .route("/{id}", web::delete().to(controller::destroy))
            // Nested scripts routes (list and create only)
            .route("/{device_firmware_id}/scripts", web::get().to(script_controller::index))
            .route("/{device_firmware_id}/script", web::post().to(script_controller::store)),
    );

    // Direct script routes (show/update/delete/build without device_firmware_id)
    cfg.service(
        web::scope("/device-firmware-script")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("/{id}", web::get().to(script_controller::show_direct))
            .route("/{id}", web::put().to(script_controller::update_direct))
            .route("/{id}", web::delete().to(script_controller::destroy_direct))
            .route("/{id}/build", web::post().to(script_controller::build)),
    );
}
