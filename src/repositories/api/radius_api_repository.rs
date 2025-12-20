use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::time::Instant;

use crate::entities::radius_client_entity::RadiusClientEntity;
use crate::entities::radius_group_profile_entity::RadiusGroupProfileEntity;
use crate::entities::radius_vendor_entity::RadiusVendorEntity;
use crate::infrastructures::radius::RadiusService;

/// Request body for adding a new RADIUS client
#[derive(Debug, Serialize)]
pub struct AddRadiusClientRequest {
    pub host: String,
    pub name: String,
    pub secret: String,
    pub description: String,
    pub vendor_id: i32,
}

/// Response from adding a new RADIUS client
#[derive(Debug, Deserialize)]
pub struct AddRadiusClientResponse {
    pub id: i32,
}

/// Response from deleting a RADIUS client
#[derive(Debug, Deserialize)]
pub struct DeleteRadiusClientResponse {
    pub message: String,
    pub status: String,
}

/// Get all RADIUS vendors from the Radius API
pub async fn get_vendors(radius_service: &RadiusService) -> Result<Vec<RadiusVendorEntity>> {
    log::debug!("radius_api:get_vendors:prepare");
    let start = Instant::now();

    match radius_service.get::<Vec<RadiusVendorEntity>>("/vendors").await {
        Ok(vendors) => {
            log::debug!(
                "radius_api:get_vendors:ok count={} elapsed_ms={}",
                vendors.len(),
                start.elapsed().as_millis()
            );
            Ok(vendors)
        }
        Err(e) => {
            log::error!(
                "radius_api:get_vendors:err err={} elapsed_ms={}",
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get all RADIUS clients from the Radius API
pub async fn get_clients(radius_service: &RadiusService) -> Result<Vec<RadiusClientEntity>> {
    log::debug!("radius_api:get_clients:prepare");
    let start = Instant::now();

    match radius_service.get::<Vec<RadiusClientEntity>>("/clients").await {
        Ok(clients) => {
            log::debug!(
                "radius_api:get_clients:ok count={} elapsed_ms={}",
                clients.len(),
                start.elapsed().as_millis()
            );
            Ok(clients)
        }
        Err(e) => {
            log::error!(
                "radius_api:get_clients:err err={} elapsed_ms={}",
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get all RADIUS group profiles from the Radius API
pub async fn get_group_profiles(radius_service: &RadiusService) -> Result<Vec<RadiusGroupProfileEntity>> {
    log::debug!("radius_api:get_group_profiles:prepare");
    let start = Instant::now();

    match radius_service.get::<Vec<RadiusGroupProfileEntity>>("/group-profiles").await {
        Ok(profiles) => {
            log::debug!(
                "radius_api:get_group_profiles:ok count={} elapsed_ms={}",
                profiles.len(),
                start.elapsed().as_millis()
            );
            Ok(profiles)
        }
        Err(e) => {
            log::error!(
                "radius_api:get_group_profiles:err err={} elapsed_ms={}",
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Get RADIUS group profiles by vendor ID from the Radius API
pub async fn get_group_profile_by_vendor_id(
    radius_service: &RadiusService,
    vendor_id: i32,
) -> Result<Vec<RadiusGroupProfileEntity>> {
    log::debug!("radius_api:get_group_profile_by_vendor_id:prepare vendor_id={}", vendor_id);
    let start = Instant::now();

    let endpoint = format!("/vendor/{}/group-profiles", vendor_id);
    match radius_service.get::<Vec<RadiusGroupProfileEntity>>(&endpoint).await {
        Ok(profiles) => {
            log::debug!(
                "radius_api:get_group_profile_by_vendor_id:ok vendor_id={} count={} elapsed_ms={}",
                vendor_id,
                profiles.len(),
                start.elapsed().as_millis()
            );
            Ok(profiles)
        }
        Err(e) => {
            log::error!(
                "radius_api:get_group_profile_by_vendor_id:err vendor_id={} err={} elapsed_ms={}",
                vendor_id,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Add a new RADIUS client via the Radius API
pub async fn add_client(
    radius_service: &RadiusService,
    request: &AddRadiusClientRequest,
) -> Result<AddRadiusClientResponse> {
    log::debug!(
        "radius_api:add_client:prepare host={} name={} vendor_id={}",
        request.host,
        request.name,
        request.vendor_id
    );
    let start = Instant::now();

    match radius_service.post::<AddRadiusClientResponse, _>("/client", request).await {
        Ok(response) => {
            log::debug!(
                "radius_api:add_client:ok id={} elapsed_ms={}",
                response.id,
                start.elapsed().as_millis()
            );
            Ok(response)
        }
        Err(e) => {
            log::error!(
                "radius_api:add_client:err host={} err={} elapsed_ms={}",
                request.host,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}

/// Delete a RADIUS client via the Radius API
pub async fn delete_client(
    radius_service: &RadiusService,
    client_id: i32,
) -> Result<DeleteRadiusClientResponse> {
    log::debug!("radius_api:delete_client:prepare client_id={}", client_id);
    let start = Instant::now();

    let endpoint = format!("/client/{}", client_id);
    match radius_service.delete::<DeleteRadiusClientResponse>(&endpoint).await {
        Ok(response) => {
            log::debug!(
                "radius_api:delete_client:ok client_id={} status={} message={} elapsed_ms={}",
                client_id,
                response.status,
                response.message,
                start.elapsed().as_millis()
            );
            Ok(response)
        }
        Err(e) => {
            log::error!(
                "radius_api:delete_client:err client_id={} err={} elapsed_ms={}",
                client_id,
                e,
                start.elapsed().as_millis()
            );
            Err(e)
        }
    }
}
