use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, web,
};
use actix_web::body::BoxBody;
use config::Config;
use futures::future::{ok, Ready};
use futures::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::sync::Arc;
use std::task::{Context, Poll};

use crate::entities::access_token_payload_entity::AccessTokenPayloadEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;
use crate::infrastructures::redis::RedisConnection;
use crate::services::validate_jwt::{self, JwtValidationError};

/// Authentication middleware factory
pub struct AuthenticationMiddleware;

impl<S> Transform<S, ServiceRequest> for AuthenticationMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error> + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthenticationMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AuthenticationMiddlewareService {
            service: Rc::new(service),
        })
    }
}

pub struct AuthenticationMiddlewareService<S> {
    service: Rc<S>,
}

/// Wrapper for auth payload stored in request extensions
#[derive(Clone)]
pub struct AuthPayload(pub AccessTokenPayloadEntity);

impl<S> Service<ServiceRequest> for AuthenticationMiddlewareService<S>
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

        // Extract dependencies from app data
        let redis_opt = req.app_data::<web::Data<RedisConnection>>().cloned();
        let oauth2_issuer_opt = req.app_data::<web::Data<OAuth2IssuerService>>().cloned();
        let config_opt = req.app_data::<web::Data<Arc<Config>>>().cloned();

        // Extract bearer token from Authorization header
        let auth_header = req
            .headers()
            .get(actix_web::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        let token = if auth_header.to_lowercase().starts_with("bearer ") {
            Some(auth_header[7..].trim().to_string())
        } else {
            None
        };

        Box::pin(async move {
            // Check if token is present
            let token = match token {
                Some(t) if !t.is_empty() => t,
                _ => {
                    log::warn!("authentication_middleware: missing or empty bearer token");
                    return Ok(req.into_response(
                        actix_web::HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": "missing or invalid authorization header"
                            }))
                    ));
                }
            };

            // Check required dependencies
            let (redis, oauth2_issuer, config) = match (redis_opt, oauth2_issuer_opt, config_opt) {
                (Some(r), Some(o), Some(c)) => (r, o, c),
                _ => {
                    log::error!("authentication_middleware: missing required dependencies");
                    return Ok(req.into_response(
                        actix_web::HttpResponse::InternalServerError()
                            .json(serde_json::json!({
                                "error": "internal configuration error"
                            }))
                    ));
                }
            };

            // Validate JWT
            match validate_jwt::execute(
                &redis.pool(),
                oauth2_issuer.get_ref(),
                &config,
                &token,
            )
            .await
            {
                Ok(payload) => {
                    log::debug!(
                        "authentication_middleware: validated sub={} azp={}",
                        payload.sub,
                        payload.azp
                    );

                    // Store payload in request extensions
                    req.extensions_mut().insert(AuthPayload(payload));

                    // Continue to next service
                    let res = srv.call(req).await?;
                    Ok(res)
                }
                Err(e) => {
                    let error_message = match &e {
                        JwtValidationError::Expired => "token has expired",
                        JwtValidationError::InvalidSignature(_) => "invalid token signature",
                        JwtValidationError::InvalidIssuer { .. } => "invalid token issuer",
                        JwtValidationError::InvalidAuthorizedParty { .. } => {
                            "token not authorized for this client"
                        }
                        JwtValidationError::InvalidFormat(_) => "invalid token format",
                        JwtValidationError::KeyNotFound(_) => "signing key not found",
                        _ => "token validation failed",
                    };

                    log::warn!("authentication_middleware: validation failed err={}", e);
                    Ok(req.into_response(
                        actix_web::HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": error_message
                            }))
                    ))
                }
            }
        })
    }
}

/// Helper function to extract auth payload from HttpRequest
#[allow(dead_code)]
pub fn extract_auth_payload(
    req: &actix_web::HttpRequest,
) -> Option<AccessTokenPayloadEntity> {
    req.extensions().get::<AuthPayload>().map(|p| p.0.clone())
}

/// Helper function to extract user sub (user_id) from HttpRequest
#[allow(dead_code)]
pub fn extract_auth_sub(req: &actix_web::HttpRequest) -> Option<String> {
    extract_auth_payload(req).map(|p| p.sub)
}
