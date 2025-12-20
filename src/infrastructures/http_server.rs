use std::sync::Arc;

use actix_web::{App, HttpServer, web};
use config::{Config, File};

use crate::infrastructures::database::DatabaseConnection;
use crate::infrastructures::elastic_search::ElasticSearchService;
use crate::infrastructures::radius::RadiusService;
use crate::infrastructures::redis::RedisConnection;
use crate::infrastructures::s3::S3Service;
use crate::middlewares::{
    include_request_id_middleware::RequestIdMiddleware, log_middleware::LogMiddleware,
};

pub struct HttpService {
    config: Arc<Config>,
    db_connection: DatabaseConnection,
    redis_connection: RedisConnection,
    s3_service: S3Service,
    radius_service: RadiusService,
}

impl HttpService {
    pub fn new(
        config: Arc<Config>,
        db_connection: DatabaseConnection,
        redis_connection: RedisConnection,
        s3_service: S3Service,
        radius_service: RadiusService,
    ) -> Self {
        Self {
            config,
            db_connection,
            redis_connection,
            s3_service,
            radius_service,
        }
    }

    pub async fn start(&self) -> std::io::Result<()> {
        let host = self
            .config
            .get_string("server.host")
            .unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = self.config.get_int("server.port").unwrap_or(8080) as u16;
        let workers = self.config.get_int("server.workers").unwrap_or(0) as usize;

        let db_connection = self.db_connection.clone();
        let redis_connection = self.redis_connection.clone();
        let s3_service = self.s3_service.clone();
        let radius_service = self.radius_service.clone();
        let config_arc = self.config.clone();
        let es_service = ElasticSearchService::new(config_arc.as_ref()).ok();

        // Best-effort ES connectivity check so failures are clearer at startup
        if let Some(es) = es_service.as_ref() {
            match es.ping().await {
                Ok(()) => log::info!("elasticsearch reachable and healthy"),
                Err(e) => log::warn!("elasticsearch health check failed: {}", e),
            }
        } else {
            log::warn!("elasticsearch service not initialized; logging to ES will be disabled");
        }

        // Read optional HTTP path prefix from config; default to empty (no prefix)
        let http_path_prefix = self
            .config
            .get_string("http_path_prefix")
            .unwrap_or_else(|_| String::new());

        let mut server = HttpServer::new(move || {
            let app = App::new()
                .app_data(web::Data::new(db_connection.clone()))
                .app_data(web::Data::new(redis_connection.clone()))
                .app_data(web::Data::new(s3_service.clone()))
                .app_data(web::Data::new(radius_service.clone()))
                .app_data(web::Data::from(config_arc.clone()))
                .app_data(web::Data::new(es_service.clone()))
                .wrap(LogMiddleware)
                .wrap(RequestIdMiddleware);

            // Apply the prefix scope only when it's non-empty and not just "/"
            if !http_path_prefix.is_empty() && http_path_prefix != "/" {
                app.service(web::scope(http_path_prefix.as_str()).configure(crate::routes::configure))
            } else {
                app.configure(crate::routes::configure)
            }
        });

        if workers > 0 {
            server = server.workers(workers);
        }

        server.bind((host.as_str(), port))?.run().await
    }
}

pub fn load_config() -> Arc<Config> {
    let builder = Config::builder().add_source(File::with_name("config/default.json"));

    let config = builder
        .build()
        .expect("failed to load application configuration");

    Arc::new(config)
}
