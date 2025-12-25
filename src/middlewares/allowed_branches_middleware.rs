use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use actix_web::body::BoxBody;
use futures::future::{ok, Ready};
use futures::Future;
use std::collections::HashSet;
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll};

use crate::entities::access_token_payload_entity::AccessTokenPayloadEntity;
use crate::middlewares::authentication_middleware::AuthPayload;

/// AllowedBranches middleware factory
/// 
/// This middleware extracts allowed branch IDs from JWT roles and stores them
/// in request extensions. It must be used AFTER AuthenticationMiddleware.
/// 
/// Role name format: "<role_type>@<branch_id>"
/// - If branch_id is "any", user has access to ALL branches
/// - Otherwise, branch_id is a specific UUID
pub struct AllowedBranchesMiddleware;

impl<S> Transform<S, ServiceRequest> for AllowedBranchesMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type InitError = ();
    type Transform = AllowedBranchesMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AllowedBranchesMiddlewareService {
            service: Rc::new(service),
        })
    }
}

pub struct AllowedBranchesMiddlewareService<S> {
    service: Rc<S>,
}

/// Wrapper for allowed branches stored in request extensions
/// If empty Vec, user has access to ALL branches ("any" access)
/// If Some with items, user has access only to those specific branches
#[derive(Clone)]
pub struct AllowedBranches {
    /// List of allowed branch IDs. Empty means "any" access (all branches allowed)
    pub branch_ids: Vec<String>,
    /// Flag indicating if user has "any" access
    pub has_any_access: bool,
}

impl<S> Service<ServiceRequest> for AllowedBranchesMiddlewareService<S>
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

        // Extract auth payload from request extensions (set by AuthenticationMiddleware)
        let auth_payload_opt = req.extensions().get::<AuthPayload>().cloned();

        Box::pin(async move {
            // Check if auth payload is present
            let auth_payload = match auth_payload_opt {
                Some(AuthPayload(payload)) => payload,
                None => {
                    log::warn!("allowed_branches_middleware: auth payload not found in request extensions");
                    return Ok(req.into_response(
                        actix_web::HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": "authentication required"
                            }))
                    ));
                }
            };

            // Extract allowed branches from roles
            let allowed_branches = extract_allowed_branch_ids(&auth_payload);

            log::debug!(
                "allowed_branches_middleware: sub={} has_any_access={} allowed_branches_count={}",
                auth_payload.sub,
                allowed_branches.has_any_access,
                allowed_branches.branch_ids.len()
            );

            // Store allowed branches in request extensions
            req.extensions_mut().insert(allowed_branches);

            // Continue to next service
            let res = srv.call(req).await?;
            Ok(res)
        })
    }
}

/// Extract allowed branch IDs from JWT roles
/// 
/// Parses the client roles and extracts branch_id from each role's name.
/// Role name format: "<role_type>@<branch_id>"
/// 
/// If any role has branch_id "any", returns AllowedBranches with has_any_access=true
fn extract_allowed_branch_ids(payload: &AccessTokenPayloadEntity) -> AllowedBranches {
    let mut allowed_branches: HashSet<String> = HashSet::new();
    let mut has_any_access = false;

    // Process client roles
    for role in &payload.roles.client {
        // Split role name by "@" to get branch_id
        let parts: Vec<&str> = role.name.split('@').collect();
        
        if parts.len() >= 2 {
            let branch_id = parts[1];
            
            if branch_id == "any" {
                has_any_access = true;
                // Continue processing to log all roles, but result will be "any" access
            } else {
                allowed_branches.insert(branch_id.to_string());
            }
        }
    }

    // If user has "any" access, return empty list with flag
    if has_any_access {
        log::debug!(
            "allowed_branches_middleware: user has 'any' access"
        );
        
        return AllowedBranches {
            branch_ids: Vec::new(),
            has_any_access: true,
        };
    }

    // Convert HashSet to Vec for storage
    let branch_ids: Vec<String> = allowed_branches.into_iter().collect();
    
    log::debug!(
        "allowed_branches_middleware: user has specific access to {} branches",
        branch_ids.len()
    );

    AllowedBranches {
        branch_ids,
        has_any_access: false,
    }
}

/// Helper function to extract allowed branches from HttpRequest
#[allow(dead_code)]
pub fn extract_allowed_branches(req: &actix_web::HttpRequest) -> Option<AllowedBranches> {
    req.extensions()
        .get::<AllowedBranches>()
        .cloned()
}

/// Helper function to get allowed branch IDs or None if user has "any" access
/// Returns Some(Vec<String>) for specific branch access, None for "any" access
#[allow(dead_code)]
pub fn get_allowed_branch_ids(req: &actix_web::HttpRequest) -> Option<Vec<String>> {
    match req.extensions().get::<AllowedBranches>() {
        Some(ab) if ab.has_any_access => None, // "any" access means no filtering
        Some(ab) => Some(ab.branch_ids.clone()),
        None => Some(Vec::new()), // No middleware = no access
    }
}

/// Helper function to check if a branch ID is allowed
#[allow(dead_code)]
pub fn is_branch_allowed(req: &actix_web::HttpRequest, branch_id: &str) -> bool {
    match req.extensions().get::<AllowedBranches>() {
        Some(ab) if ab.has_any_access => true, // "any" access allows all
        Some(ab) => ab.branch_ids.contains(&branch_id.to_string()),
        None => false,
    }
}
