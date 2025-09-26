use std::str::FromStr;
use std::sync::Arc;

use anyhow::{Context, Result, anyhow};
use config::Config;
use s3::Region;
use s3::bucket::Bucket;
use s3::creds::Credentials;

#[derive(Clone)]
#[allow(dead_code)]
pub struct S3Service {
    bucket: Arc<Bucket>,
    public_base_url: Option<String>,
}

#[allow(dead_code)]
impl S3Service {
    pub fn new(bucket: Box<Bucket>, public_base_url: Option<String>) -> Self {
        Self {
            bucket: Arc::from(bucket),
            public_base_url,
        }
    }

    pub fn bucket(&self) -> Arc<Bucket> {
        self.bucket.clone()
    }

    pub fn public_base_url(&self) -> Option<&String> {
        self.public_base_url.as_ref()
    }
}

pub async fn initialize_s3(config: &Config) -> Result<S3Service> {
    let access_key = config
        .get_string("s3.access_key_id")
        .context("s3.access_key_id is not configured")?;
    let secret_key = config
        .get_string("s3.secret_access_key")
        .context("s3.secret_access_key is not configured")?;
    let bucket_name = config
        .get_string("s3.bucket")
        .context("s3.bucket is not configured")?;
    let region_name = config
        .get_string("s3.default_region")
        .unwrap_or_else(|_| "us-east-1".to_string());
    let endpoint = config.get_string("s3.endpoint").unwrap_or_default();
    let use_path_style = config
        .get_bool("s3.use_path_style_endpoint")
        .unwrap_or(true);

    let region = if endpoint.is_empty() {
        Region::from_str(&region_name)
            .map_err(|e| anyhow!("invalid AWS region '{}': {}", region_name, e))?
    } else {
        Region::Custom {
            region: region_name.clone(),
            endpoint,
        }
    };

    let credentials = Credentials::new(Some(&access_key), Some(&secret_key), None, None, None)
        .context("failed to build S3 credentials")?;

    let mut bucket = Bucket::new(&bucket_name, region, credentials)
        .context("failed to create S3 bucket client")?;
    if use_path_style {
        bucket.set_path_style();
    }

    let public_base_url = config
        .get_string("storage_base_url")
        .ok()
        .filter(|s| !s.is_empty());

    Ok(S3Service::new(bucket, public_base_url))
}
