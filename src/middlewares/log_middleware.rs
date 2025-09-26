use actix_web::{
    Error, HttpMessage,
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
};
use chrono::{SecondsFormat, Utc};
use futures::Future;
use futures::future::{Ready, ok};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};

use crate::infrastructures::elastic_search::{ElasticSearchService, RequestLogDoc};
use crate::utils::uuid_helper;

pub type LogContextHandle = Arc<Mutex<RequestLogDoc>>;

pub struct LogMiddleware;

impl<S, B> Transform<S, ServiceRequest> for LogMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = LogMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(LogMiddlewareService { service })
    }
}

pub struct LogMiddlewareService<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for LogMiddlewareService<S>
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
        // Build initial log context with request info
        let method = req.method().to_string();
        let path = req.path().to_string();
        let user_agent = req
            .headers()
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let ip = req
            .connection_info()
            .realip_remote_addr()
            .map(|s| s.to_string())
            .or_else(|| req.peer_addr().map(|s| s.ip().to_string()));

        let mut doc = RequestLogDoc::default();
        doc.timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        doc.method = method;
        doc.path = path;
        doc.ip = ip;
        doc.user_agent = user_agent;
        // store a context handle in extensions so controllers/services can append
        let ctx: LogContextHandle = Arc::new(Mutex::new(doc));
        req.extensions_mut().insert(ctx.clone());

        // Capture ES service handle from app data (optional at this stage)
        let fut = self.service.call(req);
        Box::pin(async move {
            let res = fut.await?;

            // set status code into context
            if let Some(ctx) = res.request().extensions().get::<LogContextHandle>() {
                if let Ok(mut m) = ctx.lock() {
                    m.status = Some(res.status().as_u16());
                }
            }

            // Try to send log to ES (best-effort)
            if let Some(data) = res
                .request()
                .app_data::<actix_web::web::Data<Option<ElasticSearchService>>>()
            {
                if let Some(es) = data.get_ref().as_ref() {
                    // Build final doc clone to avoid holding the lock across await
                    let (request_id, final_doc) =
                        if let Some(ctx) = res.request().extensions().get::<LogContextHandle>() {
                            if let Ok(mut m) = ctx.lock() {
                                // Generate request_id if empty (fallback)
                                if m.request_id.is_empty() {
                                    m.request_id = uuid_helper::generate();
                                }
                                (m.request_id.clone(), m.clone())
                            } else {
                                (String::new(), RequestLogDoc::default())
                            }
                        } else {
                            (String::new(), RequestLogDoc::default())
                        };

                    if !request_id.is_empty() {
                        // Fire-and-forget: spawn background task so response isn't delayed
                        let es_clone = es.clone();
                        let rid = request_id.clone();
                        let doc = final_doc.clone();
                        actix_web::rt::spawn(async move {
                            if let Err(e) = es_clone.create(&rid, &doc).await {
                                log::warn!("elasticsearch logging failed: {}", e);
                            }
                        });
                    } else {
                        log::warn!("skipping elasticsearch log: request_id is empty");
                    }
                }
            }

            Ok(res)
        })
    }
}

// Helper utilities for other layers
#[allow(dead_code)]
pub fn add_note(req: &actix_web::HttpRequest, note: impl AsRef<str>) {
    if let Some(ctx) = req.extensions().get::<LogContextHandle>() {
        if let Ok(mut m) = ctx.lock() {
            m.notes.push(note.as_ref().to_string());
        }
    }
}

#[allow(dead_code)]
pub fn set_extra<K: AsRef<str>, V: Into<serde_json::Value>>(
    req: &actix_web::HttpRequest,
    key: K,
    val: V,
) {
    if let Some(ctx) = req.extensions().get::<LogContextHandle>() {
        if let Ok(mut m) = ctx.lock() {
            if m.extras.is_null() || !m.extras.is_object() {
                m.extras = serde_json::json!({});
            }
            if let Some(map) = m.extras.as_object_mut() {
                map.insert(key.as_ref().to_string(), val.into());
            }
        }
    }
}
