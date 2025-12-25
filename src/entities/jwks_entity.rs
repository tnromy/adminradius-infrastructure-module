use serde::{Deserialize, Serialize};

/// Single JWK key entity
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwkKeyEntity {
    pub alg: String,
    pub e: String,
    pub kid: String,
    pub kty: String,
    pub n: String,
    #[serde(rename = "use")]
    pub key_use: String,
}

/// JWKS (JSON Web Key Set) entity containing multiple keys
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwksEntity {
    pub keys: Vec<JwkKeyEntity>,
}
