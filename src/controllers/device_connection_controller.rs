use actix_web::{HttpRequest, HttpResponse, web};
use log::error;
use serde::Deserialize;
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::add_device_connection::{
    self, AddDeviceConnectionError, AddDeviceConnectionInput,
};
use crate::services::delete_device_connection::{self, DeleteDeviceConnectionError};
use crate::services::get_all_device_connections;
use crate::services::get_device_connection;
use crate::services::update_device_connection::{
    self, UpdateDeviceConnectionError, UpdateDeviceConnectionInput,
};
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;
use crate::validations::device_connection::store_validation::{self, StoreDeviceConnectionPayload};
use crate::validations::device_connection::update_validation::{
    self, UpdateDeviceConnectionPayload,
};

#[derive(Debug, Deserialize)]
pub struct DeviceConnectionsPath {
    device_id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceConnectionPath {
    device_id: String,
    connection_id: String,
}

pub async fn index(
    req: HttpRequest,
    path: web::Path<DeviceConnectionsPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };

    match get_all_device_connections::execute(db.get_ref(), &device_id).await {
        Ok(items) => ok_response(items, request_id),
        Err(err) => {
            internal_error_response(&req, request_id, "failed to fetch device connections", err)
        }
    }
}

pub async fn store(
    req: HttpRequest,
    path: web::Path<DeviceConnectionsPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<StoreDeviceConnectionPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };

    let validated = match store_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AddDeviceConnectionInput {
        device_id,
        from_port_id: validated.from_port_id,
        to_port_id: validated.to_port_id,
        details: validated.details,
    };

    match add_device_connection::execute(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_connection_id", entity.id.clone());
            ok_response(entity, request_id)
        }
        Err(AddDeviceConnectionError::DeviceNotFound) => not_found_response(request_id),
        Err(AddDeviceConnectionError::FromPortNotFound) => {
            bad_request_response(vec!["from_port_id not found".to_string()], request_id)
        }
        Err(AddDeviceConnectionError::ToPortNotFound) => {
            bad_request_response(vec!["to_port_id not found".to_string()], request_id)
        }
        Err(AddDeviceConnectionError::PortsMustBeDifferent) => bad_request_response(
            vec!["from_port_id and to_port_id must be different".to_string()],
            request_id,
        ),
        Err(AddDeviceConnectionError::PortsOnSameDevice) => bad_request_response(
            vec!["source and destination ports cannot belong to the same device".to_string()],
            request_id,
        ),
        Err(AddDeviceConnectionError::BranchMismatch) => bad_request_response(
            vec!["source and destination ports must be within the same branch".to_string()],
            request_id,
        ),
        Err(AddDeviceConnectionError::ConnectionAlreadyExists) => {
            bad_request_response(vec!["connection already exists".to_string()], request_id)
        }
        Err(AddDeviceConnectionError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to create device connection", err)
        }
    }
}

pub async fn show(
    req: HttpRequest,
    path: web::Path<DeviceConnectionPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };
    let Some(connection_id) = sanitize_id(&path.connection_id) else {
        return bad_request_response(vec!["invalid connection_id".to_string()], request_id);
    };

    match get_device_connection::execute(db.get_ref(), &device_id, &connection_id).await {
        Ok(Some(entity)) => ok_response(entity, request_id),
        Ok(None) => not_found_response(request_id),
        Err(err) => {
            internal_error_response(&req, request_id, "failed to fetch device connection", err)
        }
    }
}

pub async fn update(
    req: HttpRequest,
    path: web::Path<DeviceConnectionPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<UpdateDeviceConnectionPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };
    let Some(connection_id) = sanitize_id(&path.connection_id) else {
        return bad_request_response(vec!["invalid connection_id".to_string()], request_id);
    };

    let validated = match update_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = UpdateDeviceConnectionInput {
        id: connection_id,
        device_id,
        from_port_id: validated.from_port_id,
        to_port_id: validated.to_port_id,
        details: validated.details,
    };

    match update_device_connection::execute(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_connection_id", entity.id.clone());
            ok_response(entity, request_id)
        }
        Err(UpdateDeviceConnectionError::DeviceNotFound) => not_found_response(request_id),
        Err(UpdateDeviceConnectionError::ConnectionNotFound) => not_found_response(request_id),
        Err(UpdateDeviceConnectionError::FromPortNotFound) => {
            bad_request_response(vec!["from_port_id not found".to_string()], request_id)
        }
        Err(UpdateDeviceConnectionError::ToPortNotFound) => {
            bad_request_response(vec!["to_port_id not found".to_string()], request_id)
        }
        Err(UpdateDeviceConnectionError::PortsMustBeDifferent) => bad_request_response(
            vec!["from_port_id and to_port_id must be different".to_string()],
            request_id,
        ),
        Err(UpdateDeviceConnectionError::PortsOnSameDevice) => bad_request_response(
            vec!["source and destination ports cannot belong to the same device".to_string()],
            request_id,
        ),
        Err(UpdateDeviceConnectionError::BranchMismatch) => bad_request_response(
            vec!["source and destination ports must be within the same branch".to_string()],
            request_id,
        ),
        Err(UpdateDeviceConnectionError::ConnectionAlreadyExists) => {
            bad_request_response(vec!["connection already exists".to_string()], request_id)
        }
        Err(UpdateDeviceConnectionError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to update device connection", err)
        }
    }
}

pub async fn destroy(
    req: HttpRequest,
    path: web::Path<DeviceConnectionPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };
    let Some(connection_id) = sanitize_id(&path.connection_id) else {
        return bad_request_response(vec!["invalid connection_id".to_string()], request_id);
    };

    match delete_device_connection::execute(db.get_ref(), &device_id, &connection_id).await {
        Ok(()) => ok_response(json!({ "message": "deleted" }), request_id),
        Err(DeleteDeviceConnectionError::NotFound) => not_found_response(request_id),
        Err(DeleteDeviceConnectionError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to delete device connection", err)
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
    let errors = vec!["device connection not found".to_string()];
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
