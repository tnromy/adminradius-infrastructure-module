use actix_web::{HttpRequest, HttpResponse, web};
use log::error;
use serde::Deserialize;
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::add_device_port_specification::{
    AddDevicePortSpecificationError, AddDevicePortSpecificationInput,
    execute as add_device_port_specification,
};
use crate::services::delete_device_port_specification::{
    DeleteDevicePortSpecificationError, execute as delete_device_port_specification,
};
use crate::services::get_all_device_port_specifications::execute as get_all_device_port_specifications;
use crate::services::get_device_port_specification::execute as get_device_port_specification;
use crate::services::update_device_port_specification::{
    UpdateDevicePortSpecificationError, UpdateDevicePortSpecificationInput,
    execute as update_device_port_specification,
};
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;
use crate::validations::device_port_specification::store_validation::{
    self, StoreDevicePortSpecificationPayload,
};
use crate::validations::device_port_specification::update_validation::{
    self, UpdateDevicePortSpecificationPayload,
};

#[derive(Debug, Deserialize)]
pub struct DevicePortSpecificationPath {
    id: String,
}

pub async fn index(req: HttpRequest, db: web::Data<DatabaseConnection>) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    match get_all_device_port_specifications(db.get_ref()).await {
        Ok(items) => ok_response(items, request_id),
        Err(err) => internal_error_response(
            &req,
            request_id,
            "failed to fetch device port specifications",
            err,
        ),
    }
}

pub async fn store(
    req: HttpRequest,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<StoreDevicePortSpecificationPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    let validated = match store_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AddDevicePortSpecificationInput {
        name: validated.name,
        data: validated.data,
    };

    match add_device_port_specification(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_port_specification_id", entity.id.clone());
            ok_response(entity, request_id)
        }
        Err(AddDevicePortSpecificationError::NameAlreadyExists) => {
            bad_request_response(vec!["name already exists".to_string()], request_id)
        }
        Err(AddDevicePortSpecificationError::Database(err)) => internal_error_response(
            &req,
            request_id,
            "failed to create device port specification",
            err,
        ),
    }
}

pub async fn show(
    req: HttpRequest,
    path: web::Path<DevicePortSpecificationPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match get_device_port_specification(db.get_ref(), &id).await {
        Ok(Some(entity)) => ok_response(entity, request_id),
        Ok(None) => not_found_response(request_id),
        Err(err) => internal_error_response(
            &req,
            request_id,
            "failed to fetch device port specification",
            err,
        ),
    }
}

pub async fn update(
    req: HttpRequest,
    path: web::Path<DevicePortSpecificationPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<UpdateDevicePortSpecificationPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    let validated = match update_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = UpdateDevicePortSpecificationInput {
        id,
        name: validated.name,
        data: validated.data,
    };

    match update_device_port_specification(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_port_specification_id", entity.id.clone());
            ok_response(entity, request_id)
        }
        Err(UpdateDevicePortSpecificationError::NotFound) => not_found_response(request_id),
        Err(UpdateDevicePortSpecificationError::NameAlreadyExists) => {
            bad_request_response(vec!["name already exists".to_string()], request_id)
        }
        Err(UpdateDevicePortSpecificationError::Database(err)) => internal_error_response(
            &req,
            request_id,
            "failed to update device port specification",
            err,
        ),
    }
}

pub async fn destroy(
    req: HttpRequest,
    path: web::Path<DevicePortSpecificationPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match delete_device_port_specification(db.get_ref(), &id).await {
        Ok(()) => ok_response(json!({ "message": "deleted" }), request_id),
        Err(DeleteDevicePortSpecificationError::NotFound) => not_found_response(request_id),
        Err(DeleteDevicePortSpecificationError::Database(err)) => internal_error_response(
            &req,
            request_id,
            "failed to delete device port specification",
            err,
        ),
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
    let errors = vec!["device port specification not found".to_string()];
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
