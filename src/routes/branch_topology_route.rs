use actix_web::web::{self, ServiceConfig};

use crate::controllers::branch_topology_controller as controller;
use crate::middlewares::allowed_branches_middleware::AllowedBranchesMiddleware;
use crate::middlewares::authentication_middleware::AuthenticationMiddleware;
use crate::middlewares::branch_access_middleware::BranchAccessMiddleware;

pub fn configure(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/branch/{branch_id}/topologies")
            .wrap(BranchAccessMiddleware)
            .wrap(AllowedBranchesMiddleware)
            .wrap(AuthenticationMiddleware)
            .route("", web::get().to(controller::index)),
    );
}
