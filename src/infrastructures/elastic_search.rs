use std::sync::Arc;

use anyhow::{Context, Result, anyhow};
use chrono::{Datelike, Utc};
use config::Config;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RequestLogDoc {
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub ip: Option<String>,
    pub user_agent: Option<String>,
    pub status: Option<u16>,
    pub request_id: String,
    pub notes: Vec<String>,
    pub extras: Value,
}

impl Default for RequestLogDoc {
    fn default() -> Self {
        Self {
            timestamp: String::new(),
            method: String::new(),
            path: String::new(),
            ip: None,
            user_agent: None,
            status: None,
            request_id: String::new(),
            notes: Vec::new(),
            extras: Value::Null,
        }
    }
}

#[derive(Clone)]
pub struct ElasticSearchService {
    client: Arc<Client>,
    endpoint: String,
    index_prefix: String,
}

impl ElasticSearchService {
    pub fn new(config: &Config) -> Result<Self> {
        let endpoint = config
            .get_string("elastic_search.endpoint")
            .context("elastic_search.endpoint is not configured")?;
        let index_prefix = config
            .get_string("elastic_search.index_prefix")
            .context("elastic_search.index_prefix is not configured")?;

        let client = Client::builder()
            .user_agent("adminradius-infrastructure-service")
            .build()
            .context("failed to build Elasticsearch HTTP client")?;

        Ok(Self {
            client: Arc::new(client),
            endpoint,
            index_prefix,
        })
    }

    fn index_for_today(&self) -> String {
        let today = Utc::now();
        format!(
            "{}-{:04}-{:02}-{:02}",
            self.index_prefix,
            today.year(),
            today.month(),
            today.day()
        )
    }

    fn base_endpoint(&self) -> &str {
        self.endpoint.trim_end_matches('/')
    }

    pub async fn create(&self, request_id: &str, doc: &RequestLogDoc) -> Result<()> {
        let index = self.index_for_today();
        let url = format!("{}/{}/_doc/{}", self.base_endpoint(), index, request_id);

        let response = self
            .client
            .put(url)
            .json(doc)
            .send()
            .await
            .context("failed to send log to Elasticsearch")?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(anyhow!(
                "elasticsearch rejected document: status={}, body={}",
                status,
                body
            ))
        }
    }
}
