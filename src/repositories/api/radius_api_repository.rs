use anyhow::Result;
use tokio::time::Instant;

use crate::entities::radius_client_entity::RadiusClientEntity;
use crate::entities::radius_group_profile_entity::RadiusGroupProfileEntity;
use crate::entities::radius_vendor_entity::RadiusVendorEntity;
use crate::infrastructures::radius::RadiusService;

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
