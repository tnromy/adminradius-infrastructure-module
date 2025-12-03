use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use config::Config;
use reqwest::Client;
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CaOpenvpnApiResponse<T> {
    pub status: CaOpenvpnApiStatus,
    pub request_id: String,
    pub data: T,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CaOpenvpnApiStatus {
    pub code: u16,
    pub message: String,
}

#[derive(Clone)]
pub struct CaOpenvpnService {
    client: Arc<Client>,
    base_api_endpoint: String,
    access_token: String,
}

impl CaOpenvpnService {
    pub fn new(config: &Config) -> Result<Self> {
        let base_api_endpoint = config
            .get_string("ca_openvpn.base_api_endpoint")
            .context("ca_openvpn.base_api_endpoint is not configured")?;

        let access_token = config
            .get_string("ca_openvpn.access_token")
            .context("ca_openvpn.access_token is not configured")?;

        let client = Client::builder()
            .user_agent("adminradius-core-service")
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(30))
            .build()
            .context("failed to build OpenVPN CA HTTP client")?;

        Ok(Self {
            client: Arc::new(client),
            base_api_endpoint,
            access_token,
        })
    }

    fn base_endpoint(&self) -> &str {
        self.base_api_endpoint.trim_end_matches('/')
    }

    fn auth_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if !self.access_token.is_empty() {
            let bearer = format!("Bearer {}", self.access_token);
            if let Ok(value) = HeaderValue::from_str(&bearer) {
                headers.insert(AUTHORIZATION, value);
            }
        }
        headers
    }

    /// Send GET request to the OpenVPN CA API
    pub async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("ca_openvpn:get:request url={}", url);

        let response = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .with_context(|| format!("failed to send GET request to OpenVPN CA API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenVPN CA API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: CaOpenvpnApiResponse<T> = response
            .json()
            .await
            .context("failed to parse OpenVPN CA API response")?;

        log::debug!(
            "ca_openvpn:get:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Send POST request to the OpenVPN CA API
    pub async fn post<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("ca_openvpn:post:request url={}", url);

        let response = self
            .client
            .post(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await
            .with_context(|| format!("failed to send POST request to OpenVPN CA API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenVPN CA API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: CaOpenvpnApiResponse<T> = response
            .json()
            .await
            .context("failed to parse OpenVPN CA API response")?;

        log::debug!(
            "ca_openvpn:post:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Send PUT request to the OpenVPN CA API (without body)
    pub async fn put_no_body<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("ca_openvpn:put:request url={}", url);

        let response = self
            .client
            .put(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .with_context(|| format!("failed to send PUT request to OpenVPN CA API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenVPN CA API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: CaOpenvpnApiResponse<T> = response
            .json()
            .await
            .context("failed to parse OpenVPN CA API response")?;

        log::debug!(
            "ca_openvpn:put:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Send PUT request to the OpenVPN CA API (with body)
    pub async fn put<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("ca_openvpn:put:request url={}", url);

        let response = self
            .client
            .put(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await
            .with_context(|| format!("failed to send PUT request to OpenVPN CA API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenVPN CA API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: CaOpenvpnApiResponse<T> = response
            .json()
            .await
            .context("failed to parse OpenVPN CA API response")?;

        log::debug!(
            "ca_openvpn:put:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Send DELETE request to the OpenVPN CA API
    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("ca_openvpn:delete:request url={}", url);

        let response = self
            .client
            .delete(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .with_context(|| format!("failed to send DELETE request to OpenVPN CA API: {}", url))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenVPN CA API returned error: status={}, body={}",
                status,
                body
            );
        }

        let api_response: CaOpenvpnApiResponse<T> = response
            .json()
            .await
            .context("failed to parse OpenVPN CA API response")?;

        log::debug!(
            "ca_openvpn:delete:success url={} request_id={}",
            url,
            api_response.request_id
        );

        Ok(api_response.data)
    }

    /// Simple health check against the OpenVPN CA API
    pub async fn ping(&self) -> Result<()> {
        let url = format!("{}/health", self.base_endpoint());
        log::debug!("ca_openvpn:ping:request url={}", url);

        let response = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .context("failed to reach OpenVPN CA API health endpoint")?;

        if response.status().is_success() {
            log::debug!("ca_openvpn:ping:success");
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenVPN CA API health check failed: status={}, body={}",
                status,
                body
            )
        }
    }

    /// Send GET request with JSON body to the OpenVPN CA API and return binary response
    ///
    /// # Arguments
    /// * `path` - The API endpoint path
    /// * `body` - The JSON body to send with the request
    ///
    /// # Returns
    /// * `Vec<u8>` containing the raw binary response data
    pub async fn get_binary<B>(&self, path: &str, body: &B) -> Result<Vec<u8>>
    where
        B: Serialize,
    {
        let url = format!("{}{}", self.base_endpoint(), path);
        log::debug!("ca_openvpn:get_binary:request url={}", url);

        let response = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await
            .with_context(|| {
                format!(
                    "failed to send GET binary request to OpenVPN CA API: {}",
                    url
                )
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenVPN CA API returned error: status={}, body={}",
                status,
                error_body
            );
        }

        let bytes = response
            .bytes()
            .await
            .context("failed to read binary response from OpenVPN CA API")?;

        log::debug!(
            "ca_openvpn:get_binary:success url={} size={}",
            url,
            bytes.len()
        );

        Ok(bytes.to_vec())
    }
}
