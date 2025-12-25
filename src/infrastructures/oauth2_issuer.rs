use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use config::Config;
use reqwest::Client;

#[derive(Clone)]
pub struct OAuth2IssuerService {
    client: Arc<Client>,
    issuer: String,
    jwks_path: String,
}

impl OAuth2IssuerService {
    pub fn new(config: &Config) -> Result<Self> {
        let issuer = config
            .get_string("oauth2.issuer")
            .context("oauth2.issuer is not configured")?;
        let jwks_path = config
            .get_string("oauth2.jwks_path")
            .unwrap_or_else(|_| "/jwks".to_string());

        let client = Client::builder()
            .user_agent("adminradius-infrastructure-module")
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .context("failed to build HTTP client for OAuth2 issuer")?;

        Ok(Self {
            client: Arc::new(client),
            issuer,
            jwks_path,
        })
    }

    pub fn jwks_endpoint(&self) -> String {
        format!("{}{}", self.issuer, self.jwks_path)
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn issuer(&self) -> &str {
        &self.issuer
    }
}

/// Initialize OAuth2 issuer service from config
pub fn initialize_oauth2_issuer(config: &Config) -> Result<OAuth2IssuerService> {
    OAuth2IssuerService::new(config)
}
