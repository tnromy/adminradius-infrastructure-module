use actix_web::{HttpRequest, HttpResponse, web};
use config::Config;
use log::error;

use crate::infrastructures::radius::RadiusService;
use crate::infrastructures::redis::RedisConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::get_radius_vendors;
use crate::utils::http_response_helper;

/// GET /radius-client/vendors
/// Returns list of RADIUS vendors from cache or external API
pub async fn index_vendors(
    req: HttpRequest,
    radius_service: web::Data<RadiusService>,
    redis: web::Data<RedisConnection>,
    config: web::Data<Config>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    // Get cache key prefix from config, default to "radius_vendors"
    let key_prefix = config
        .get_string("radius.cache_key_prefix")
        .unwrap_or_else(|_| "radius_vendors".to_string());

    match get_radius_vendors::execute(
        radius_service.get_ref(),
        redis.get_ref(),
        &key_prefix,
    )
    .await
    {
        Ok(vendors) => ok_response(vendors, request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch radius vendors", err),
    }
}

fn ok_response<T: serde::Serialize>(data: T, request_id: Option<String>) -> HttpResponse {
    match request_id {
        Some(rid) => http_response_helper::response_json_ok_with_request_id(data, rid),
        None => http_response_helper::response_json_ok(data),
    }
}

fn internal_error_response<E: std::fmt::Display>(
    req: &HttpRequest,
    request_id: Option<String>,
    message: &str,
    error: E,
) -> HttpResponse {
    error!("{}: {}", message, error);
    log_middleware::add_note(req, format!("{}: {}", message, error));
    let errors = vec![message.to_string()];
    match request_id {
        Some(rid) => http_response_helper::response_json_error_500_with_request_id(errors, rid),
        None => http_response_helper::response_json_error_500(errors),
    }
}
