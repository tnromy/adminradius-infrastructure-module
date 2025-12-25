mod controllers;
mod entities;
mod infrastructures;
mod middlewares;
mod presentations;
mod repositories;
mod routes;
mod services;
mod utils;
mod validations;

use infrastructures::database::initialize_database;
use infrastructures::http_server::{HttpService, load_config};
use infrastructures::oauth2_issuer::initialize_oauth2_issuer;
use infrastructures::radius::RadiusService;
use infrastructures::redis::initialize_redis;
use infrastructures::s3::initialize_s3;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    if std::env::var("RUST_LOG").is_ok() {
        env_logger::init();
    } else {
        let mut builder = env_logger::Builder::new();
        builder.filter_level(log::LevelFilter::Info);
        builder.parse_default_env();
        builder.init();
    }
    log::info!("logger initialized");

    let config = load_config();
    log::info!("config loaded");

    let db = initialize_database(config.as_ref())
        .await
        .expect("Failed to initialize database connection");
    log::info!("database initialized");

    let redis = initialize_redis(config.as_ref())
        .await
        .expect("Failed to initialize redis connection");
    log::info!("redis initialized");

    let s3 = initialize_s3(config.as_ref())
        .await
        .expect("Failed to initialize S3 connection");
    log::info!("s3 initialized");

    let radius = RadiusService::new(config.as_ref())
        .expect("Failed to initialize Radius service");
    log::info!("radius service initialized");

    let oauth2_issuer = initialize_oauth2_issuer(config.as_ref())
        .expect("Failed to initialize OAuth2 issuer service");
    log::info!("oauth2 issuer initialized");

    let http = HttpService::new(config.clone(), db, redis, s3, radius, oauth2_issuer);
    log::info!("starting http server");
    http.start().await
}
