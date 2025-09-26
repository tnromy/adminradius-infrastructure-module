use crate::middlewares::log_middleware::LogContextHandle;
use crate::utils::uuid_helper;
use actix_web::dev::{Service, Transform};
use actix_web::{
    Error, HttpMessage,
    dev::{ServiceRequest, ServiceResponse},
};
use futures::Future;
use futures::future::{Ready, ok};
use std::pin::Pin;
use std::task::{Context, Poll};

pub struct RequestIdMiddleware;

impl<S, B> Transform<S, ServiceRequest> for RequestIdMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RequestIdMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(RequestIdMiddlewareService { service })
    }
}

pub struct RequestIdMiddlewareService<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for RequestIdMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Generate request ID
        let request_id = uuid_helper::generate();

        // Store request_id in request extensions
        req.extensions_mut().insert(RequestId(request_id.clone()));

        // Also set into LogContext if present
        if let Some(ctx) = req.extensions().get::<LogContextHandle>() {
            if let Ok(mut m) = ctx.lock() {
                m.request_id = request_id.clone();
            }
        }

        let fut = self.service.call(req);

        Box::pin(async move {
            let mut res = fut.await?;

            // Add request_id to response headers
            res.headers_mut().insert(
                actix_web::http::header::HeaderName::from_static("x-request-id"),
                actix_web::http::header::HeaderValue::from_str(&request_id).unwrap(),
            );

            Ok(res)
        })
    }
}

// Struct untuk menyimpan request_id
#[derive(Clone)]
#[allow(dead_code)]
pub struct RequestId(pub String);

// Helper function untuk mengambil request_id dari HttpRequest (untuk controller)
#[allow(dead_code)]
pub fn extract_request_id(req: &actix_web::HttpRequest) -> Option<String> {
    req.extensions().get::<RequestId>().map(|id| id.0.clone())
}
