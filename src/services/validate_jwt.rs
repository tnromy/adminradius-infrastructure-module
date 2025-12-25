use config::Config;
use deadpool_redis::Pool;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use std::sync::Arc;

use crate::entities::access_token_payload_entity::AccessTokenPayloadEntity;
use crate::entities::jwks_entity::JwksEntity;
use crate::infrastructures::oauth2_issuer::OAuth2IssuerService;
use crate::services::get_jwks;

/// JWT validation error types
#[derive(Debug)]
pub enum JwtValidationError {
    /// JWT format is invalid
    InvalidFormat(String),
    /// JWT signature verification failed
    InvalidSignature(String),
    /// JWT has expired
    Expired,
    /// JWT issuer doesn't match expected issuer
    InvalidIssuer { expected: String, actual: String },
    /// JWT authorized party (azp) doesn't match expected client_id
    InvalidAuthorizedParty { expected: String, actual: String },
    /// JWKS fetch failed
    JwksFetchError(String),
    /// Key ID not found in JWKS
    KeyNotFound(String),
    /// Internal error
    InternalError(String),
}

impl std::fmt::Display for JwtValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JwtValidationError::InvalidFormat(msg) => {
                write!(f, "invalid JWT format: {}", msg)
            }
            JwtValidationError::InvalidSignature(msg) => {
                write!(f, "invalid JWT signature: {}", msg)
            }
            JwtValidationError::Expired => write!(f, "JWT has expired"),
            JwtValidationError::InvalidIssuer { expected, actual } => {
                write!(f, "invalid issuer: expected '{}', got '{}'", expected, actual)
            }
            JwtValidationError::InvalidAuthorizedParty { expected, actual } => {
                write!(
                    f,
                    "invalid authorized party (azp): expected '{}', got '{}'",
                    expected, actual
                )
            }
            JwtValidationError::JwksFetchError(msg) => {
                write!(f, "JWKS fetch error: {}", msg)
            }
            JwtValidationError::KeyNotFound(kid) => {
                write!(f, "key not found in JWKS: kid={}", kid)
            }
            JwtValidationError::InternalError(msg) => {
                write!(f, "internal error: {}", msg)
            }
        }
    }
}

/// Validate JWT and return payload if valid
pub async fn execute(
    redis_pool: &Arc<Pool>,
    oauth2_issuer: &OAuth2IssuerService,
    config: &Arc<Config>,
    token: &str,
) -> Result<AccessTokenPayloadEntity, JwtValidationError> {
    log::debug!("service:validate_jwt:execute:start");

    // 1. Decode JWT header to get kid (key ID)
    let header = decode_header(token).map_err(|e| {
        log::error!("service:validate_jwt:execute:header_decode_error err={}", e);
        JwtValidationError::InvalidFormat(e.to_string())
    })?;

    let kid = header.kid.ok_or_else(|| {
        log::error!("service:validate_jwt:execute:no_kid_in_header");
        JwtValidationError::InvalidFormat("no kid in JWT header".to_string())
    })?;

    log::debug!("service:validate_jwt:execute:kid={}", kid);

    // 2. Get JWKS (from cache or API) and find the key
    let decoding_key = get_decoding_key_for_kid(redis_pool, oauth2_issuer, config, &kid).await?;

    // 3. Get expected values from config
    let expected_issuer = config
        .get_string("oauth2.issuer")
        .map_err(|e| {
            JwtValidationError::InternalError(format!("config error: {}", e))
        })?;
    let expected_client_id = config
        .get_string("oauth2.client_id")
        .map_err(|e| {
            JwtValidationError::InternalError(format!("config error: {}", e))
        })?;

    // 4. Setup validation
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;
    validation.set_issuer(&[&expected_issuer]);
    // Disable aud validation, we validate azp instead
    validation.validate_aud = false;

    // 5. Decode and validate JWT
    let token_data = decode::<AccessTokenPayloadEntity>(
        token,
        &decoding_key,
        &validation,
    )
    .map_err(|e| {
        log::error!("service:validate_jwt:execute:decode_error err={}", e);
        match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                JwtValidationError::Expired
            }
            jsonwebtoken::errors::ErrorKind::InvalidIssuer => {
                JwtValidationError::InvalidIssuer {
                    expected: expected_issuer.clone(),
                    actual: "unknown".to_string(),
                }
            }
            jsonwebtoken::errors::ErrorKind::InvalidSignature => {
                JwtValidationError::InvalidSignature(e.to_string())
            }
            _ => JwtValidationError::InvalidFormat(e.to_string()),
        }
    })?;

    let payload = token_data.claims;

    // 6. Validate azp (authorized party) matches client_id
    if payload.azp != expected_client_id {
        log::error!(
            "service:validate_jwt:execute:invalid_azp expected={} actual={}",
            expected_client_id,
            payload.azp
        );
        return Err(JwtValidationError::InvalidAuthorizedParty {
            expected: expected_client_id,
            actual: payload.azp,
        });
    }

    // 7. Validate iss matches expected issuer
    if payload.iss != expected_issuer {
        log::error!(
            "service:validate_jwt:execute:invalid_iss expected={} actual={}",
            expected_issuer,
            payload.iss
        );
        return Err(JwtValidationError::InvalidIssuer {
            expected: expected_issuer,
            actual: payload.iss,
        });
    }

    log::debug!(
        "service:validate_jwt:execute:ok sub={} azp={} iss={}",
        payload.sub,
        payload.azp,
        payload.iss
    );

    Ok(payload)
}

/// Find JWK key by kid
fn find_key_by_kid<'a>(
    jwks: &'a JwksEntity,
    kid: &str,
) -> Result<&'a crate::entities::jwks_entity::JwkKeyEntity, JwtValidationError> {
    // Log available kids for debugging
    let available_kids: Vec<&str> = jwks.keys.iter().map(|k| k.kid.as_str()).collect();
    log::debug!(
        "service:validate_jwt:find_key_by_kid looking_for={} available={:?}",
        kid,
        available_kids
    );

    jwks.keys
        .iter()
        .find(|key| key.kid == kid)
        .ok_or_else(|| {
            log::error!(
                "service:validate_jwt:find_key_by_kid:not_found kid={} available_kids={:?}",
                kid,
                available_kids
            );
            JwtValidationError::KeyNotFound(kid.to_string())
        })
}

/// Get decoding key for a specific kid, with automatic refresh if not found
async fn get_decoding_key_for_kid(
    redis_pool: &Arc<Pool>,
    oauth2_issuer: &OAuth2IssuerService,
    config: &Arc<Config>,
    kid: &str,
) -> Result<DecodingKey, JwtValidationError> {
    // First, try to get JWKS from cache
    let jwks = get_jwks::execute(redis_pool, oauth2_issuer, config)
        .await
        .map_err(JwtValidationError::JwksFetchError)?;

    // Try to find the key
    if let Some(jwk) = jwks.keys.iter().find(|key| key.kid == kid) {
        log::debug!("service:validate_jwt:get_decoding_key:found_in_cache kid={}", kid);
        return create_decoding_key(jwk);
    }

    // Key not found in cache, try force refresh from OAuth2 issuer
    log::info!(
        "service:validate_jwt:get_decoding_key:kid_not_in_cache_refreshing kid={}",
        kid
    );

    let jwks_refreshed = get_jwks::execute_force_refresh(redis_pool, oauth2_issuer, config)
        .await
        .map_err(JwtValidationError::JwksFetchError)?;

    // Try to find the key after refresh
    let jwk = find_key_by_kid(&jwks_refreshed, kid)?;
    create_decoding_key(jwk)
}

/// Create DecodingKey from JWK (RSA)
fn create_decoding_key(
    jwk: &crate::entities::jwks_entity::JwkKeyEntity,
) -> Result<DecodingKey, JwtValidationError> {
    if jwk.kty != "RSA" {
        return Err(JwtValidationError::InvalidFormat(format!(
            "unsupported key type: {}",
            jwk.kty
        )));
    }

    DecodingKey::from_rsa_components(&jwk.n, &jwk.e).map_err(|e| {
        JwtValidationError::InvalidFormat(format!("failed to create decoding key: {}", e))
    })
}
