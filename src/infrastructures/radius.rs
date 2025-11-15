use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use config::Config;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RadiusApiResponse<T> {
    pub status: RadiusApiStatus,
    pub request_id: String,
    pub data: T,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RadiusApiStatus {
    pub code: u16,
    pub message: String,
}

#[derive(Clone)]
pub struct RadiusService {
    client: Arc<Client>,
    base_api_endpoint: String,
}

impl RadiusService {
    pub fn new(config: &Config) -> Result<Self> {
        let base_api_endpoint = config
            .get_string("radius.base_api_endpoint")
            .context("radius.base_api_endpoint is not configured")?;

        let client = Client::builder()
            .user_agent("adminradius-core-service")
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .build()
            .context("failed to build Radius HTTP client")?;

        Ok(Self {
            client: Arc::new(client),
            base_api_endpoint,
        })
    }

    fn base_endpoint(&self) -> &str {
        self.base_api_endpoint.trim_end_matches('/')
    }

    /// Send GET request to the Radius API
    pub async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("radius:get:request url={}", url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("failed to send GET request to Radius API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "radius API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: RadiusApiResponse<T> = response
            .json()
            .await
            .context("failed to parse Radius API response")?;

        log::debug!(
            "radius:get:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Send POST request to the Radius API
    pub async fn post<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("radius:post:request url={}", url);

        let response = self
            .client
            .post(&url)
            .json(body)
            .send()
            .await
            .with_context(|| format!("failed to send POST request to Radius API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "radius API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: RadiusApiResponse<T> = response
            .json()
            .await
            .context("failed to parse Radius API response")?;

        log::debug!(
            "radius:post:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Send PUT request to the Radius API
    pub async fn put<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("radius:put:request url={}", url);

        let response = self
            .client
            .put(&url)
            .json(body)
            .send()
            .await
            .with_context(|| format!("failed to send PUT request to Radius API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "radius API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: RadiusApiResponse<T> = response
            .json()
            .await
            .context("failed to parse Radius API response")?;

        log::debug!(
            "radius:put:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Send DELETE request to the Radius API
    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("radius:delete:request url={}", url);

        let response = self
            .client
            .delete(&url)
            .send()
            .await
            .with_context(|| format!("failed to send DELETE request to Radius API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "radius API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: RadiusApiResponse<T> = response
            .json()
            .await
            .context("failed to parse Radius API response")?;

        log::debug!(
            "radius:delete:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Simple health check against the Radius API
    pub async fn ping(&self) -> Result<()> {
        let url = format!("{}/health", self.base_endpoint());
        log::debug!("radius:ping:request url={}", url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .context("failed to reach Radius API health endpoint")?;

        if response.status().is_success() {
            log::debug!("radius:ping:success");
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "radius API health check failed: status={}, body={}",
                status,
                body
            )
        }
    }
}
