use actix_web::{HttpRequest, HttpResponse, web};
use log::error;
use serde::Deserialize;
use serde_json::json;

use crate::infrastructures::database::DatabaseConnection;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::add_device_firmware_script::{
    AddDeviceFirmwareScriptError, AddDeviceFirmwareScriptInput, execute as add_device_firmware_script,
};
use crate::services::delete_device_firmware_script::{DeleteDeviceFirmwareScriptError, execute as delete_device_firmware_script};
use crate::services::get_all_device_firmware_scripts::{GetAllDeviceFirmwareScriptsError, execute as get_all_device_firmware_scripts};
use crate::services::get_device_firmware_script::execute as get_device_firmware_script;
use crate::services::update_device_firmware_script::{
    UpdateDeviceFirmwareScriptError, UpdateDeviceFirmwareScriptInput, execute as update_device_firmware_script,
};
use crate::utils::http_response_helper;
use crate::utils::xss_security_helper;
use crate::validations::device_firmware_script::store_validation::{self, StoreDeviceFirmwareScriptPayload};
use crate::validations::device_firmware_script::update_validation::{self, UpdateDeviceFirmwareScriptPayload};

#[derive(Debug, Deserialize)]
pub struct DeviceFirmwareScriptPath {
    device_firmware_id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceFirmwareScriptItemPath {
    device_firmware_id: String,
    id: String,
}

pub async fn index(
    req: HttpRequest,
    path: web::Path<DeviceFirmwareScriptPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(firmware_id) = sanitize_id(&path.device_firmware_id) else {
        return bad_request_response(vec!["invalid device_firmware_id".to_string()], request_id);
    };

    match get_all_device_firmware_scripts(db.get_ref(), &firmware_id).await {
        Ok(items) => ok_response(items, request_id),
        Err(GetAllDeviceFirmwareScriptsError::FirmwareNotFound) => firmware_not_found_response(request_id),
        Err(GetAllDeviceFirmwareScriptsError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to fetch device firmware scripts", err)
        }
    }
}

pub async fn store(
    req: HttpRequest,
    path: web::Path<DeviceFirmwareScriptPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<StoreDeviceFirmwareScriptPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(firmware_id) = sanitize_id(&path.device_firmware_id) else {
        return bad_request_response(vec!["invalid device_firmware_id".to_string()], request_id);
    };

    let validated = match store_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AddDeviceFirmwareScriptInput {
        device_firmware_id: firmware_id,
        name: validated.name,
        description: validated.description,
        script_text: validated.script_text,
        script_params: validated.script_params,
    };

    match add_device_firmware_script(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_firmware_script_id", entity.id.to_string());
            ok_response(entity, request_id)
        }
        Err(AddDeviceFirmwareScriptError::FirmwareNotFound) => {
            firmware_not_found_response(request_id)
        }
        Err(AddDeviceFirmwareScriptError::NameAlreadyExists) => {
            bad_request_response(vec!["script name already exists in this firmware".to_string()], request_id)
        }
        Err(AddDeviceFirmwareScriptError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to create device firmware script", err)
        }
    }
}

pub async fn show(
    req: HttpRequest,
    path: web::Path<DeviceFirmwareScriptItemPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(_firmware_id) = sanitize_id(&path.device_firmware_id) else {
        return bad_request_response(vec!["invalid device_firmware_id".to_string()], request_id);
    };
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match get_device_firmware_script(db.get_ref(), &id).await {
        Ok(Some(entity)) => ok_response(entity, request_id),
        Ok(None) => not_found_response(request_id),
        Err(err) => internal_error_response(&req, request_id, "failed to fetch device firmware script", err),
    }
}

pub async fn update(
    req: HttpRequest,
    path: web::Path<DeviceFirmwareScriptItemPath>,
    db: web::Data<DatabaseConnection>,
    payload: web::Json<UpdateDeviceFirmwareScriptPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(_firmware_id) = sanitize_id(&path.device_firmware_id) else {
        return bad_request_response(vec!["invalid device_firmware_id".to_string()], request_id);
    };
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    let validated = match update_validation::validate(payload.into_inner()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = UpdateDeviceFirmwareScriptInput {
        id,
        name: validated.name,
        description: validated.description,
        script_text: validated.script_text,
        script_params: validated.script_params,
    };

    match update_device_firmware_script(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_firmware_script_id", entity.id.to_string());
            ok_response(entity, request_id)
        }
        Err(UpdateDeviceFirmwareScriptError::NotFound) => not_found_response(request_id),
        Err(UpdateDeviceFirmwareScriptError::NameAlreadyExists) => {
            bad_request_response(vec!["script name already exists in this firmware".to_string()], request_id)
        }
        Err(UpdateDeviceFirmwareScriptError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to update device firmware script", err)
        }
    }
}

pub async fn destroy(
    req: HttpRequest,
    path: web::Path<DeviceFirmwareScriptItemPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(_firmware_id) = sanitize_id(&path.device_firmware_id) else {
        return bad_request_response(vec!["invalid device_firmware_id".to_string()], request_id);
    };
    let Some(id) = sanitize_id(&path.id) else {
        return bad_request_response(vec!["invalid id".to_string()], request_id);
    };

    match delete_device_firmware_script(db.get_ref(), &id).await {
        Ok(()) => ok_response(json!({ "message": "deleted" }), request_id),
        Err(DeleteDeviceFirmwareScriptError::NotFound) => not_found_response(request_id),
        Err(DeleteDeviceFirmwareScriptError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to delete device firmware script", err)
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
    let errors = vec!["device firmware script not found".to_string()];
    match request_id {
        Some(rid) => http_response_helper::response_json_error_404_with_request_id(errors, rid),
        None => http_response_helper::response_json_error_404(errors),
    }
}

fn firmware_not_found_response(request_id: Option<String>) -> HttpResponse {
    let errors = vec!["device firmware not found".to_string()];
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
