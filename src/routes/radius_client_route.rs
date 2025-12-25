use actix_web::web::{self, ServiceConfig};

use crate::controllers::radius_client_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    // RADIUS client related endpoints
    cfg.service(
        web::scope("/radius-client")
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("/vendors", web::get().to(controller::index_vendors)),
    );
}
