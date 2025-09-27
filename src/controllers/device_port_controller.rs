use actix_web::{HttpRequest, HttpResponse, web};
use log::error;
use serde::Deserialize;
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::add_device_port::{self, AddDevicePortError, AddDevicePortInput};
use crate::services::delete_device_port::{self, DeleteDevicePortError};
use crate::services::get_all_device_ports;
use crate::services::get_device_port;
use crate::services::update_device_port::{self, UpdateDevicePortError, UpdateDevicePortInput};
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;
use crate::validations::device_port::store_validation::{self, StoreDevicePortPayload};
use crate::validations::device_port::update_validation::{self, UpdateDevicePortPayload};

#[derive(Debug, Deserialize)]
pub struct DevicePortsPath {
    device_id: String,
}

#[derive(Debug, Deserialize)]
pub struct DevicePortPath {
    device_id: String,
    port_id: String,
}

pub async fn index(
    req: HttpRequest,
    path: web::Path<DevicePortsPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };

    match get_all_device_ports::execute(db.get_ref(), &device_id).await {
        Ok(items) => ok_response(json!({ "items": items }), request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch device ports", err),
    }
}

pub async fn store(
    req: HttpRequest,
    path: web::Path<DevicePortsPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<StoreDevicePortPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };

    let validated = match store_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AddDevicePortInput {
        device_id,
        port_interface_id: validated.port_interface_id,
        port_specification_id: validated.port_specification_id,
        name: validated.name,
        position: validated.position,
        enabled: validated.enabled,
        properties: validated.properties,
    };

    match add_device_port::execute(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_port_id", entity.id.clone());
            ok_response(json!({ "item": entity }), request_id)
        }
        Err(AddDevicePortError::DeviceNotFound) => not_found_response(request_id),
        Err(AddDevicePortError::PortInterfaceNotFound) => {
            bad_request_response(vec!["port_interface_id not found".to_string()], request_id)
        }
        Err(AddDevicePortError::PortSpecificationNotFound) => bad_request_response(
            vec!["port_specification_id not found".to_string()],
            request_id,
        ),
        Err(AddDevicePortError::NameAlreadyExists) => bad_request_response(
            vec!["name already exists on device".to_string()],
            request_id,
        ),
        Err(AddDevicePortError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to create device port", err)
        }
    }
}

pub async fn show(
    req: HttpRequest,
    path: web::Path<DevicePortPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };
    let Some(port_id) = sanitize_id(&path.port_id) else {
        return bad_request_response(vec!["invalid port_id".to_string()], request_id);
    };

    match get_device_port::execute(db.get_ref(), &device_id, &port_id).await {
        Ok(Some(entity)) => ok_response(json!({ "item": entity }), request_id),
        Ok(None) => not_found_response(request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch device port", err),
    }
}

pub async fn update(
    req: HttpRequest,
    path: web::Path<DevicePortPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<UpdateDevicePortPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };
    let Some(port_id) = sanitize_id(&path.port_id) else {
        return bad_request_response(vec!["invalid port_id".to_string()], request_id);
    };

    let validated = match update_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = UpdateDevicePortInput {
        id: port_id,
        device_id,
        port_interface_id: validated.port_interface_id,
        port_specification_id: validated.port_specification_id,
        name: validated.name,
        position: validated.position,
        enabled: validated.enabled,
        properties: validated.properties,
    };

    match update_device_port::execute(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_port_id", entity.id.clone());
            ok_response(json!({ "item": entity }), request_id)
        }
        Err(UpdateDevicePortError::DeviceNotFound) => not_found_response(request_id),
        Err(UpdateDevicePortError::PortNotFound) => not_found_response(request_id),
        Err(UpdateDevicePortError::PortInterfaceNotFound) => {
            bad_request_response(vec!["port_interface_id not found".to_string()], request_id)
        }
        Err(UpdateDevicePortError::PortSpecificationNotFound) => bad_request_response(
            vec!["port_specification_id not found".to_string()],
            request_id,
        ),
        Err(UpdateDevicePortError::NameAlreadyExists) => bad_request_response(
            vec!["name already exists on device".to_string()],
            request_id,
        ),
        Err(UpdateDevicePortError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to update device port", err)
        }
    }
}

pub async fn destroy(
    req: HttpRequest,
    path: web::Path<DevicePortPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };
    let Some(port_id) = sanitize_id(&path.port_id) else {
        return bad_request_response(vec!["invalid port_id".to_string()], request_id);
    };

    match delete_device_port::execute(db.get_ref(), &device_id, &port_id).await {
        Ok(()) => ok_response(json!({ "deleted": true }), request_id),
        Err(DeleteDevicePortError::NotFound) => not_found_response(request_id),
        Err(DeleteDevicePortError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to delete device port", err)
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
    let errors = vec!["device port not found".to_string()];
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
