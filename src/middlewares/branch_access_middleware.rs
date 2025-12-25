use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use actix_web::body::BoxBody;
use futures::future::{ok, Ready};
use futures::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll};

use crate::middlewares::allowed_branches_middleware::AllowedBranches;
use crate::middlewares::include_request_id_middleware::RequestId;
use crate::utils::http_response_helper;

/// BranchAccess middleware factory
/// 
/// This middleware checks if the user has access to the branch specified in the path.
/// It must be used AFTER AllowedBranchesMiddleware.
/// 
/// This middleware extracts `branch_id` from the path parameter and checks if it
/// exists in the AllowedBranches list set by the previous middleware.
/// 
/// If the user doesn't have access to the branch, it returns a 403 Forbidden response.
pub struct BranchAccessMiddleware;

impl<S> Transform<S, ServiceRequest> for BranchAccessMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type InitError = ();
    type Transform = BranchAccessMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(BranchAccessMiddlewareService {
            service: Rc::new(service),
        })
    }
}

pub struct BranchAccessMiddlewareService<S> {
    service: Rc<S>,
}

impl<S> Service<ServiceRequest> for BranchAccessMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let srv = self.service.clone();

        // Extract branch_id from path parameters
        let branch_id = req.match_info().get("branch_id").map(|s| s.to_string());

        // Extract allowed branches from request extensions (set by AllowedBranchesMiddleware)
        let allowed_branches_opt = req.extensions().get::<AllowedBranches>().cloned();

        // Extract request_id for error response
        let request_id = req
            .extensions()
            .get::<RequestId>()
            .map(|r| r.0.clone());

        Box::pin(async move {
            // Check if branch_id is present in path
            let branch_id = match branch_id {
                Some(id) if !id.is_empty() => id,
                _ => {
                    log::warn!("branch_access_middleware: branch_id not found in path");
                    // If no branch_id in path, let the request continue
                    // (this middleware is only for /branch/{branch_id}/... routes)
                    let res = srv.call(req).await?;
                    return Ok(res);
                }
            };

            // Check if allowed branches is present
            let allowed_branches = match allowed_branches_opt {
                Some(ab) => ab,
                None => {
                    log::warn!("branch_access_middleware: allowed_branches not found in request extensions");
                    let response = match request_id {
                        Some(rid) => http_response_helper::response_json_error_403_with_request_id(
                            vec!["Access denied: authentication required".to_string()],
                            rid,
                        ),
                        None => http_response_helper::response_json_error_403(
                            vec!["Access denied: authentication required".to_string()],
                        ),
                    };
                    return Ok(req.into_response(response));
                }
            };

            // Check access
            let has_access = if allowed_branches.has_any_access {
                // User has "any" access - allow all branches
                log::debug!(
                    "branch_access_middleware: user has 'any' access, allowing branch_id={}",
                    branch_id
                );
                true
            } else {
                // Check if branch_id is in the allowed list
                allowed_branches.branch_ids.contains(&branch_id)
            };

            if !has_access {
                log::warn!(
                    "branch_access_middleware: access denied for branch_id={} allowed_count={}",
                    branch_id,
                    allowed_branches.branch_ids.len()
                );
                let response = match request_id {
                    Some(rid) => http_response_helper::response_json_error_403_with_request_id(
                        vec![format!("Access denied: you don't have permission to access branch '{}'", branch_id)],
                        rid,
                    ),
                    None => http_response_helper::response_json_error_403(
                        vec![format!("Access denied: you don't have permission to access branch '{}'", branch_id)],
                    ),
                };
                return Ok(req.into_response(response));
            }

            log::debug!(
                "branch_access_middleware: access granted for branch_id={}",
                branch_id
            );

            // Continue to next service
            let res = srv.call(req).await?;
            Ok(res)
        })
    }
}

/// Helper function to check if a branch is accessible from HttpRequest
/// This can be used in controllers for additional validation
#[allow(dead_code)]
pub fn check_branch_access(req: &actix_web::HttpRequest, branch_id: &str) -> bool {
    match req.extensions().get::<AllowedBranches>() {
        Some(ab) if ab.has_any_access => true,
        Some(ab) => ab.branch_ids.contains(&branch_id.to_string()),
        None => false,
    }
}
