use actix_web::{web, HttpRequest, HttpResponse};
use log::error;
use serde::Deserialize;
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::get_branch_topology;
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;

#[derive(Debug, Deserialize)]
pub struct BranchPath {
    branch_id: String,
}

#[derive(Debug, Deserialize)]
pub struct BranchTopologyQuery {
    #[serde(default)]
    limit_level: Option<i32>,
}

pub async fn index(
    req: HttpRequest,
    path: web::Path<BranchPath>,
    query: web::Query<BranchTopologyQuery>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(branch_id) = sanitize_id(&path.branch_id) else {
        return bad_request_response(vec!["invalid branch_id".to_string()], request_id);
    };

    let limit_level = match sanitize_limit_level(query.into_inner().limit_level) {
        Ok(limit) => limit,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    match get_branch_topology::execute(db.get_ref(), &branch_id, limit_level).await {
        Ok(nodes) => ok_response(json!({ "items": nodes }), request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch branch topology", err),
    }
}

fn sanitize_id(raw: &str) -> Option<String> {
    let sanitized = xss_security_helper::sanitize_input(raw, 64);
    let safe = xss_security_helper::strip_dangerous_tags(&sanitized);
    if safe.len() == 36 { Some(safe) } else { None }
}

fn sanitize_limit_level(value: Option<i32>) -> Result<Option<i32>, Vec<String>> {
    match value {
        Some(level) if level < 0 => Err(vec!["limit_level must be a non-negative integer".to_string()]),
        Some(level) => Ok(Some(level)),
        None => Ok(None),
    }
}

fn ok_response<T: serde::Serialize>(data: T, request_id: Option<String>) -> HttpResponse {
    match request_id {
        Some(rid) => http_response_helper::response_json_ok_with_request_id(data, rid),
        None => http_response_helper::response_json_ok(data),
    }
}

fn bad_request_response(errors: Vec<String>, request_id: Option<String>) -> HttpResponse {
    match request_id {
        Some(rid) => http_response_helper::response_json_error_400_with_request_id(errors, rid),
        None => http_response_helper::response_json_error_400(errors),
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
