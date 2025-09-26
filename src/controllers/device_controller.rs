use actix_web::{HttpRequest, HttpResponse, web};
use log::error;
use serde::Deserialize;
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::add_device::{self, AddDeviceError, AddDeviceInput};
use crate::services::delete_device::{self, DeleteDeviceError};
use crate::services::get_all_devices;
use crate::services::get_device;
use crate::services::update_device::{self, UpdateDeviceError, UpdateDeviceInput};
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;
use crate::validations::device::store_validation::{self, StoreDevicePayload};
use crate::validations::device::update_validation::{self, UpdateDevicePayload};

#[derive(Debug, Deserialize)]
pub struct BranchPath {
    branch_id: String,
}

#[derive(Debug, Deserialize)]
pub struct DevicePath {
    branch_id: String,
    device_id: String,
}

pub async fn index(
    req: HttpRequest,
    path: web::Path<BranchPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(branch_id) = sanitize_id(&path.branch_id) else {
        return bad_request_response(vec!["invalid branch_id".to_string()], request_id);
    };

    match get_all_devices::execute(db.get_ref(), &branch_id).await {
        Ok(items) => ok_response(json!({ "items": items }), request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch devices", err),
    }
}

pub async fn store(
    req: HttpRequest,
    path: web::Path<BranchPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<StoreDevicePayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(branch_id) = sanitize_id(&path.branch_id) else {
        return bad_request_response(vec!["invalid branch_id".to_string()], request_id);
    };

    let validated = match store_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AddDeviceInput {
        branch_id,
        name: validated.name,
        device_type_id: validated.device_type_id,
        latitude: validated.latitude,
        longitude: validated.longitude,
        location_details: validated.location_details,
        specifications: validated.specifications,
    };

    match add_device::execute(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_id", entity.id.clone());
            ok_response(json!({ "item": entity }), request_id)
        }
        Err(AddDeviceError::DeviceTypeNotFound) => {
            bad_request_response(vec!["device_type_id not found".to_string()], request_id)
        }
        Err(AddDeviceError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to create device", err)
        }
    }
}

pub async fn show(
    req: HttpRequest,
    path: web::Path<DevicePath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(branch_id) = sanitize_id(&path.branch_id) else {
        return bad_request_response(vec!["invalid branch_id".to_string()], request_id);
    };
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };

    match get_device::execute(db.get_ref(), &branch_id, &device_id).await {
        Ok(Some(entity)) => ok_response(json!({ "item": entity }), request_id),
        Ok(None) => not_found_response(request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch device", err),
    }
}

pub async fn update(
    req: HttpRequest,
    path: web::Path<DevicePath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<UpdateDevicePayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(branch_id) = sanitize_id(&path.branch_id) else {
        return bad_request_response(vec!["invalid branch_id".to_string()], request_id);
    };
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };

    let validated = match update_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = UpdateDeviceInput {
        id: device_id,
        branch_id,
        name: validated.name,
        device_type_id: validated.device_type_id,
        latitude: validated.latitude,
        longitude: validated.longitude,
        location_details: validated.location_details,
        specifications: validated.specifications,
    };

    match update_device::execute(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_id", entity.id.clone());
            ok_response(json!({ "item": entity }), request_id)
        }
        Err(UpdateDeviceError::NotFound) => not_found_response(request_id),
        Err(UpdateDeviceError::DeviceTypeNotFound) => {
            bad_request_response(vec!["device_type_id not found".to_string()], request_id)
        }
        Err(UpdateDeviceError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to update device", err)
        }
    }
}

pub async fn destroy(
    req: HttpRequest,
    path: web::Path<DevicePath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(branch_id) = sanitize_id(&path.branch_id) else {
        return bad_request_response(vec!["invalid branch_id".to_string()], request_id);
    };
    let Some(device_id) = sanitize_id(&path.device_id) else {
        return bad_request_response(vec!["invalid device_id".to_string()], request_id);
    };

    match delete_device::execute(db.get_ref(), &branch_id, &device_id).await {
        Ok(()) => ok_response(json!({ "deleted": true }), request_id),
        Err(DeleteDeviceError::NotFound) => not_found_response(request_id),
        Err(DeleteDeviceError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to delete device", err)
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
    let errors = vec!["device not found".to_string()];
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
