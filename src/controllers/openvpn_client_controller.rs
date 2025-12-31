use actix_web::{HttpRequest, HttpResponse, web};
use config::Config;
use log::error;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::entities::openvpn_client_entity::OpenvpnClientResponse;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::add_openvpn_client::{
    AddOpenvpnClientError, AddOpenvpnClientInput, execute as add_openvpn_client,
};
use crate::services::delete_openvpn_client::{
    DeleteOpenvpnClientError, execute as delete_openvpn_client,
};
use crate::services::get_openvpn_clients::execute as get_openvpn_clients;
use crate::services::show_openvpn_client::execute as show_openvpn_client;
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;
use crate::validations::openvpn_client::store_validation::{self, StoreOpenvpnClientPayload};

#[derive(Debug, Deserialize)]
pub struct OpenvpnClientPath {
    id: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenvpnClientServerPath {
    openvpn_server_id: String,
}

/// GET /openvpn-server/{openvpn_server_id}/clients
pub async fn index(
    req: HttpRequest,
    path: web::Path<OpenvpnClientServerPath>,
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    
    let Some(server_id) = sanitize_uuid(&path.openvpn_server_id) else {
        return bad_request_response(vec!["invalid openvpn_server_id".to_string()], request_id);
    };

    match get_openvpn_clients(db.get_ref(), redis.get_ref(), &server_id, true).await {
        Ok(items) => {
            let responses: Vec<OpenvpnClientResponse> = items.into_iter().map(|e| e.into()).collect();
            ok_response(responses, request_id)
        }
        Err(err) => internal_error_response(&req, request_id, "failed to fetch openvpn clients", err),
    }
}

/// POST /openvpn-server/{openvpn_server_id}/client
pub async fn store(
    req: HttpRequest,
    path: web::Path<OpenvpnClientServerPath>,
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
    config: web::Data<Arc<Config>>,
    payload: web::Json<StoreOpenvpnClientPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    let validated = match store_validation::validate(path.openvpn_server_id.clone(), payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AddOpenvpnClientInput {
        openvpn_server_id: validated.openvpn_server_id,
        name: validated.name,
    };

    match add_openvpn_client(db.get_ref(), redis.get_ref(), config.as_ref().as_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "openvpn_client_id", entity.id.clone());
            let response: OpenvpnClientResponse = entity.into();
            ok_response(response, request_id)
        }
        Err(AddOpenvpnClientError::ServerNotFound) => {
            not_found_response("openvpn server not found", request_id)
        }
        Err(AddOpenvpnClientError::Config(msg)) => {
            internal_error_response(&req, request_id, "configuration error", msg)
        }
        Err(AddOpenvpnClientError::CaService(msg)) => {
            internal_error_response(&req, request_id, "CA service error", msg)
        }
        Err(AddOpenvpnClientError::CertificateGeneration(msg)) => {
            internal_error_response(&req, request_id, "certificate generation error", msg)
        }
        Err(AddOpenvpnClientError::PassphraseEncryption(msg)) => {
            internal_error_response(&req, request_id, "passphrase encryption error", msg)
        }
        Err(AddOpenvpnClientError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to create openvpn client", err)
        }
    }
}

/// GET /openvpn-client/{id}
pub async fn show(
    req: HttpRequest,
    path: web::Path<OpenvpnClientPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_uuid(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match show_openvpn_client(db.get_ref(), &id).await {
        Ok(Some(entity)) => {
            let response: OpenvpnClientResponse = entity.into();
            ok_response(response, request_id)
        }
        Ok(None) => not_found_response("openvpn client not found", request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch openvpn client", err),
    }
}

/// DELETE /openvpn-client/{id}
pub async fn destroy(
    req: HttpRequest,
    path: web::Path<OpenvpnClientPath>,
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_uuid(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match delete_openvpn_client(db.get_ref(), redis.get_ref(), &id).await {
        Ok(()) => ok_response(json!({ "message": "deleted" }), request_id),
        Err(DeleteOpenvpnClientError::NotFound) => {
            not_found_response("openvpn client not found", request_id)
        }
        Err(DeleteOpenvpnClientError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to delete openvpn client", err)
        }
    }
}

fn sanitize_uuid(raw: &str) -> Option<String> {
    let sanitized = xss_security_helper::sanitize_input(raw, 64);
    let safe = xss_security_helper::strip_dangerous_tags(&sanitized);
    if safe.len() == 36 && uuid::Uuid::parse_str(&safe).is_ok() {
        Some(safe)
    } else {
        None
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

fn not_found_response(message: &str, request_id: Option<String>) -> HttpResponse {
    let errors = vec![message.to_string()];
    match request_id {
        Some(rid) => http_response_helper::response_json_error_404_with_request_id(errors, rid),
        None => http_response_helper::response_json_error_404(errors),
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
