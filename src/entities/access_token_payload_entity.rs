use serde::{Deserialize, Serialize};

use crate::entities::role_entity::RoleEntity;

/// Roles structure in access token payload
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessTokenRolesEntity {
    pub system: Vec<RoleEntity>,
    pub client: Vec<RoleEntity>,
}

/// Access token (JWT) payload entity
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessTokenPayloadEntity {
    /// Audience - array of resource server identifiers
    pub aud: Vec<String>,
    /// Roles assigned to the user
    pub roles: AccessTokenRolesEntity,
    /// OAuth2 scopes (space-separated string)
    pub scope: String,
    /// Subject - user ID
    pub sub: String,
    /// Authorized party - client_id
    pub azp: String,
    /// JWT ID - unique identifier for this token
    pub jti: String,
    /// Issuer - OAuth2 issuer URL
    pub iss: String,
    /// Expiration time (Unix timestamp)
    pub exp: i64,
    /// Issued at time (Unix timestamp)
    pub iat: i64,
}
