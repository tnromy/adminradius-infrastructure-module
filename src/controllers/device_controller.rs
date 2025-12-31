use actix_web::{HttpRequest, HttpResponse, web};
use config::Config;
use log::error;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::entities::device_radius_client_entity::DeviceRadiusClientResponse;
use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::radius::RadiusService;
use crate::middlewares::include_request_id_middleware;
use crate::middlewares::log_middleware;
use crate::services::activate_device_radius_client::{
    self, ActivateDeviceRadiusClientError, ActivateDeviceRadiusClientInput,
};
use crate::services::add_device::{self, AddDeviceError, AddDeviceInput};
use crate::services::assign_device_openvpn_client::{
    self, AssignDeviceOpenvpnClientError, AssignDeviceOpenvpnClientInput,
};
use crate::services::deactivate_device_radius_client::{
    self, DeactivateDeviceRadiusClientError, DeactivateDeviceRadiusClientInput,
};
use crate::services::delete_device::{self, DeleteDeviceError};
use crate::services::get_all_devices;
use crate::services::get_device;
use crate::services::unassign_device_openvpn_client::{
    self, UnassignDeviceOpenvpnClientError, UnassignDeviceOpenvpnClientInput,
};
use crate::services::update_device::{self, UpdateDeviceError, UpdateDeviceInput};
use crate::utils::http_response_helper;
use crate::utils::sql_security_helper;
use crate::utils::xss_security_helper;
use crate::validations::device::activate_radius_client_validation;
use crate::validations::device::assign_openvpn_client_validation;
use crate::validations::device::deactivate_radius_client_validation;
use crate::validations::device::store_validation::{self, StoreDevicePayload};
use crate::validations::device::unassign_openvpn_client_validation;
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

#[derive(Debug, Deserialize)]
pub struct DeviceOpenvpnClientPath {
    device_id: String,
    openvpn_client_id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceRadiusClientPath {
    device_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ActivateRadiusClientPayload {
    device_vendor_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct DeviceIndexQuery {
    #[serde(default)]
    search: Option<String>,
}

pub async fn index(
    req: HttpRequest,
    path: web::Path<BranchPath>,
    query: web::Query<DeviceIndexQuery>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);
    let Some(branch_id) = sanitize_id(&path.branch_id) else {
        return bad_request_response(vec!["invalid branch_id".to_string()], request_id);
    };

    // Sanitize search input to prevent SQL injection
    let search = query.search.as_ref().map(|s| {
        let sanitized = sql_security_helper::sanitize_search_keyword(s);
        if sanitized.is_empty() { None } else { Some(sanitized) }
    }).flatten();

    match get_all_devices::execute(db.get_ref(), &branch_id, search.as_deref()).await {
        Ok(items) => ok_response(items, request_id),
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
            ok_response(entity, request_id)
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
        Ok(Some(entity)) => ok_response(entity, request_id),
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
            ok_response(entity, request_id)
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
        Ok(()) => ok_response(json!({ "message": "deleted" }), request_id),
        Err(DeleteDeviceError::NotFound) => not_found_response(request_id),
        Err(DeleteDeviceError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to delete device", err)
        }
    }
}

pub async fn assign_openvpn_client(
    req: HttpRequest,
    path: web::Path<DeviceOpenvpnClientPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    let validated = match assign_openvpn_client_validation::validate(
        path.device_id.clone(),
        path.openvpn_client_id.clone(),
    ) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = AssignDeviceOpenvpnClientInput {
        device_id: validated.device_id,
        openvpn_client_id: validated.openvpn_client_id,
    };

    match assign_device_openvpn_client::execute(db.get_ref(), input).await {
        Ok(entity) => {
            log_middleware::set_extra(&req, "device_id", entity.device_id.clone());
            log_middleware::set_extra(&req, "openvpn_client_id", entity.openvpn_client_id.clone());
            ok_response(entity, request_id)
        }
        Err(AssignDeviceOpenvpnClientError::DeviceNotFound) => {
            not_found_response_custom("device not found", request_id)
        }
        Err(AssignDeviceOpenvpnClientError::DeviceNotRouter) => {
            bad_request_response(
                vec!["device must be of type 'Router' to assign OpenVPN client".to_string()],
                request_id,
            )
        }
        Err(AssignDeviceOpenvpnClientError::OpenvpnClientNotFound) => {
            not_found_response_custom("openvpn client not found", request_id)
        }
        Err(AssignDeviceOpenvpnClientError::DeviceAlreadyAssigned) => {
            bad_request_response(
                vec!["device already has an OpenVPN client assigned".to_string()],
                request_id,
            )
        }
        Err(AssignDeviceOpenvpnClientError::OpenvpnClientAlreadyAssigned) => {
            bad_request_response(
                vec!["openvpn client already assigned to another device".to_string()],
                request_id,
            )
        }
        Err(AssignDeviceOpenvpnClientError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to assign openvpn client", err)
        }
    }
}

pub async fn unassign_openvpn_client(
    req: HttpRequest,
    path: web::Path<DeviceOpenvpnClientPath>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    let validated = match unassign_openvpn_client_validation::validate(
        path.device_id.clone(),
        path.openvpn_client_id.clone(),
    ) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = UnassignDeviceOpenvpnClientInput {
        device_id: validated.device_id,
        openvpn_client_id: validated.openvpn_client_id,
    };

    match unassign_device_openvpn_client::execute(db.get_ref(), input).await {
        Ok(()) => ok_response(json!({ "message": "unassigned" }), request_id),
        Err(UnassignDeviceOpenvpnClientError::AssignmentNotFound) => {
            not_found_response_custom("assignment not found", request_id)
        }
        Err(UnassignDeviceOpenvpnClientError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to unassign openvpn client", err)
        }
    }
}

pub async fn activate_radius_client(
    req: HttpRequest,
    path: web::Path<DeviceRadiusClientPath>,
    db: web::Data<DatabaseConnection>,
    config: web::Data<Arc<Config>>,
    radius_service: web::Data<RadiusService>,
    payload: web::Json<ActivateRadiusClientPayload>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    let validated = match activate_radius_client_validation::validate(
        path.device_id.clone(),
        payload.device_vendor_id,
    ) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = ActivateDeviceRadiusClientInput {
        device_id: validated.device_id,
        device_vendor_id: validated.device_vendor_id,
    };

    match activate_device_radius_client::execute(
        db.get_ref(),
        config.as_ref().as_ref(),
        radius_service.get_ref(),
        input,
    )
    .await
    {
        Ok(result) => {
            log_middleware::set_extra(&req, "device_id", path.device_id.clone());
            log_middleware::set_extra(&req, "radius_client_id", result.entity.radius_client_id.to_string());
            let response = DeviceRadiusClientResponse::from_entity_with_secret(
                result.entity,
                result.secret,
            );
            ok_response(response, request_id)
        }
        Err(ActivateDeviceRadiusClientError::DeviceNotFound) => {
            not_found_response_custom("device not found", request_id)
        }
        Err(ActivateDeviceRadiusClientError::NoOpenvpnClientAssigned) => {
            bad_request_response(
                vec!["device has no OpenVPN client assigned".to_string()],
                request_id,
            )
        }
        Err(ActivateDeviceRadiusClientError::OpenvpnClientNotFound) => {
            bad_request_response(
                vec!["OpenVPN client not found".to_string()],
                request_id,
            )
        }
        Err(ActivateDeviceRadiusClientError::NoReservedIpAddress) => {
            bad_request_response(
                vec!["OpenVPN client has no reserved IP address".to_string()],
                request_id,
            )
        }
        Err(ActivateDeviceRadiusClientError::AlreadyActivated) => {
            bad_request_response(
                vec!["radius client already activated for this device".to_string()],
                request_id,
            )
        }
        Err(ActivateDeviceRadiusClientError::Config(msg)) => {
            internal_error_response(&req, request_id, "configuration error", msg)
        }
        Err(ActivateDeviceRadiusClientError::RadiusApi(msg)) => {
            internal_error_response(&req, request_id, "radius API error", msg)
        }
        Err(ActivateDeviceRadiusClientError::Encryption(msg)) => {
            internal_error_response(&req, request_id, "encryption error", msg)
        }
        Err(ActivateDeviceRadiusClientError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to activate radius client", err)
        }
    }
}

pub async fn deactivate_radius_client(
    req: HttpRequest,
    path: web::Path<DeviceRadiusClientPath>,
    db: web::Data<DatabaseConnection>,
    radius_service: web::Data<RadiusService>,
) -> HttpResponse {
    let request_id = include_request_id_middleware::extract_request_id(&req);

    let validated = match deactivate_radius_client_validation::validate(path.device_id.clone()) {
        Ok(validated) => validated,
        Err(errors) => return bad_request_response(errors, request_id),
    };

    let input = DeactivateDeviceRadiusClientInput {
        device_id: validated.device_id,
    };

    match deactivate_device_radius_client::execute(db.get_ref(), radius_service.get_ref(), input)
        .await
    {
        Ok(()) => ok_response(json!({ "message": "deactivated" }), request_id),
        Err(DeactivateDeviceRadiusClientError::NoOpenvpnClientAssigned) => {
            bad_request_response(
                vec!["device has no OpenVPN client assigned".to_string()],
                request_id,
            )
        }
        Err(DeactivateDeviceRadiusClientError::NotActivated) => {
            bad_request_response(
                vec!["radius client not activated for this device".to_string()],
                request_id,
            )
        }
        Err(DeactivateDeviceRadiusClientError::RadiusApi(msg)) => {
            internal_error_response(&req, request_id, "radius API error", msg)
        }
        Err(DeactivateDeviceRadiusClientError::Database(err)) => {
            internal_error_response(&req, request_id, "failed to deactivate radius client", err)
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

fn not_found_response_custom(message: &str, request_id: Option<String>) -> HttpResponse {
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
