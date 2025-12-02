use actix_web::{HttpRequest, HttpResponse, web};
use log::error;
use serde::Deserialize;
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::redis::RedisConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::add_openvpn_server::{
    AddOpenvpnServerError, AddOpenvpnServerInput, execute as add_openvpn_server,
};
use crate::services::delete_openvpn_server::{
    DeleteOpenvpnServerError, execute as delete_openvpn_server,
};
use crate::services::get_openvpn_servers::execute as get_openvpn_servers;
use crate::services::show_openvpn_server::execute as show_openvpn_server;
use crate::services::update_openvpn_server::{
    UpdateOpenvpnServerError, UpdateOpenvpnServerInput, execute as update_openvpn_server,
};
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;
use crate::validations::openvpn_server::store_validation::{self, StoreOpenvpnServerPayload};
use crate::validations::openvpn_server::update_validation::{self, UpdateOpenvpnServerPayload};

#[derive(Debug, Deserialize)]
pub struct OpenvpnServerPath {
    id: String,
}

pub async fn index(
    req: HttpRequest,
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    match get_openvpn_servers(db.get_ref(), redis.get_ref(), true).await {
        Ok(items) => ok_response(items, request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch openvpn servers", err),
    }
}

pub async fn store(
    req: HttpRequest,
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
    payload: web::Json<StoreOpenvpnServerPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    let validated = match store_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AddOpenvpnServerInput {
        name: validated.name,
        host: validated.host,
        port: validated.port,
        proto: validated.proto,
        cipher: validated.cipher,
        auth_algorithm: validated.auth_algorithm,
        tls_key_pem: validated.tls_key_pem,
        tls_key_mode: validated.tls_key_mode,
        ca_chain_pem: validated.ca_chain_pem,
        remote_cert_tls_name: validated.remote_cert_tls_name,
        crl_distribution_point: validated.crl_distribution_point,
    };

    match add_openvpn_server(db.get_ref(), redis.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "openvpn_server_id", entity.id.clone());
            ok_response(entity, request_id)
        }
        Err(AddOpenvpnServerError::NameAlreadyExists) => {
            bad_request_response(vec!["name already exists".to_string()], request_id)
        }
        Err(AddOpenvpnServerError::HostPortAlreadyExists) => {
            bad_request_response(vec!["host and port combination already exists".to_string()], request_id)
        }
        Err(AddOpenvpnServerError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to create openvpn server", err)
        }
    }
}

pub async fn show(
    req: HttpRequest,
    path: web::Path<OpenvpnServerPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match show_openvpn_server(db.get_ref(), &id).await {
        Ok(Some(entity)) => ok_response(entity, request_id),
        Ok(None) => not_found_response(request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch openvpn server", err),
    }
}

pub async fn update(
    req: HttpRequest,
    path: web::Path<OpenvpnServerPath>,
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
    payload: web::Json<UpdateOpenvpnServerPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    let validated = match update_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = UpdateOpenvpnServerInput {
        id,
        name: validated.name,
        host: validated.host,
        port: validated.port,
        proto: validated.proto,
        cipher: validated.cipher,
        auth_algorithm: validated.auth_algorithm,
        tls_key_pem: validated.tls_key_pem,
        tls_key_mode: validated.tls_key_mode,
        ca_chain_pem: validated.ca_chain_pem,
        remote_cert_tls_name: validated.remote_cert_tls_name,
        crl_distribution_point: validated.crl_distribution_point,
    };

    match update_openvpn_server(db.get_ref(), redis.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "openvpn_server_id", entity.id.clone());
            ok_response(entity, request_id)
        }
        Err(UpdateOpenvpnServerError::NotFound) => not_found_response(request_id),
        Err(UpdateOpenvpnServerError::NameAlreadyExists) => {
            bad_request_response(vec!["name already exists".to_string()], request_id)
        }
        Err(UpdateOpenvpnServerError::HostPortAlreadyExists) => {
            bad_request_response(vec!["host and port combination already exists".to_string()], request_id)
        }
        Err(UpdateOpenvpnServerError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to update openvpn server", err)
        }
    }
}

pub async fn destroy(
    req: HttpRequest,
    path: web::Path<OpenvpnServerPath>,
    db: web::Data<DatabaseConnection>,
    redis: web::Data<RedisConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match delete_openvpn_server(db.get_ref(), redis.get_ref(), &id).await {
        Ok(()) => ok_response(json!({ "message": "deleted" }), request_id),
        Err(DeleteOpenvpnServerError::NotFound) => not_found_response(request_id),
        Err(DeleteOpenvpnServerError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to delete openvpn server", err)
        }
    }
}

fn sanitize_id(raw: &str) -> Option<String> {
    let sanitized = xss_security_helper::sanitize_input(raw, 64);
    let safe = xss_security_helper::strip_dangerous_tags(&sanitized);
    if safe.len() == 36 { Some(safe) } else { None }
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

fn not_found_response(request_id: Option<String>) -> HttpResponse {
    let errors = vec!["openvpn server not found".to_string()];
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
