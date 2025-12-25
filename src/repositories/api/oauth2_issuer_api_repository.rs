use anyhow::Result;
use tokio::time::Instant;

use crate::entities::jwks_entity::JwksEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;

/// Get JWKS from OAuth2 issuer
pub async fn get_jwks(oauth2_issuer: &OAuth2IssuerService) -> Result<JwksEntity> {
    log::debug!("oauth2_issuer_api:get_jwks:start");

    let start = Instant::now();
    let endpoint = oauth2_issuer.jwks_endpoint();

    let response = oauth2_issuer
        .client()
        .get(&endpoint)
        .send()
        .await?;

    let status = response.status();
    log::debug!(
        "oauth2_issuer_api:get_jwks:response status={} elapsed_ms={}",
        status,
        start.elapsed().as_millis()
    );

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("JWKS request failed: status={} body={}", status, body);
    }

    let jwks: JwksEntity = response.json().await?;

    log::debug!(
        "oauth2_issuer_api:get_jwks:ok keys_count={} elapsed_ms={}",
        jwks.keys.len(),
        start.elapsed().as_millis()
    );

    Ok(jwks)
}
