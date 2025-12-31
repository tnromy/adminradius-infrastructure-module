use actix_web::HttpResponse;
use actix_web::cookie::{Cookie, SameSite, time::Duration};
use serde::Serialize;
use serde_json::{Value, json};

#[derive(Serialize)]
struct ResponseStatus {
    code: u16,
    message: String,
}
#[derive(Serialize)]
struct JsonResponse {
    status: ResponseStatus,
    request_id: Option<String>,
    data: Value,
}

pub fn response_json_ok<T: Serialize>(data: T) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 200,
            message: "Ok".to_string(),
        },
        request_id: None,
        data: json!(data),
    };
    HttpResponse::Ok().json(response)
}

pub fn response_json_ok_with_request_id<T: Serialize>(data: T, request_id: String) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 200,
            message: "Ok".to_string(),
        },
        request_id: Some(request_id),
        data: json!(data),
    };
    HttpResponse::Ok().json(response)
}

pub fn response_json_ok_basic<T: Serialize>(data: &T) -> HttpResponse {
    HttpResponse::Ok().json(data)
}

pub fn response_json_ok_basic_with_request_id<T: Serialize>(
    data: &T,
    request_id: String,
) -> HttpResponse {
    let mut resp = HttpResponse::Ok();
    resp.append_header((
        actix_web::http::header::HeaderName::from_static("x-request-id"),
        request_id.clone(),
    ));
    resp.json(data)
}

pub fn response_json_error_400_basic(err_obj: &serde_json::Value) -> HttpResponse {
    HttpResponse::BadRequest().json(err_obj)
}

pub fn response_json_error_400_basic_with_request_id(
    err_obj: &serde_json::Value,
    request_id: String,
) -> HttpResponse {
    let mut resp = HttpResponse::BadRequest();
    resp.append_header((
        actix_web::http::header::HeaderName::from_static("x-request-id"),
        request_id.clone(),
    ));
    resp.json(err_obj)
}

#[allow(dead_code)]
pub fn response_json_error_400(errors: Vec<String>) -> HttpResponse {
    HttpResponse::BadRequest().json(JsonResponse {
        status: ResponseStatus {
            code: 400,
            message: "Bad Request".to_string(),
        },
        request_id: None,
        data: json!({ "errors": errors }),
    })
}

#[allow(dead_code)]
pub fn response_json_error_400_with_request_id(
    errors: Vec<String>,
    request_id: String,
) -> HttpResponse {
    HttpResponse::BadRequest().json(JsonResponse {
        status: ResponseStatus {
            code: 400,
            message: "Bad Request".to_string(),
        },
        request_id: Some(request_id),
        data: json!({ "errors": errors }),
    })
}

#[allow(dead_code)]
pub fn response_json_error_401(errors: Vec<String>) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 401,
            message: "Unauthorized".to_string(),
        },
        request_id: None,
        data: json!({ "errors": errors }),
    };

    HttpResponse::Unauthorized().json(response)
}

#[allow(dead_code)]
pub fn response_json_error_401_with_request_id(
    errors: Vec<String>,
    request_id: String,
) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 401,
            message: "Unauthorized".to_string(),
        },
        request_id: Some(request_id),
        data: json!({ "errors": errors }),
    };

    HttpResponse::Unauthorized().json(response)
}

#[allow(dead_code)]
pub fn response_json_error_403(errors: Vec<String>) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 403,
            message: "Forbidden".to_string(),
        },
        request_id: None,
        data: json!({ "errors": errors }),
    };

    HttpResponse::Forbidden().json(response)
}

#[allow(dead_code)]
pub fn response_json_error_403_with_request_id(
    errors: Vec<String>,
    request_id: String,
) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 403,
            message: "Forbidden".to_string(),
        },
        request_id: Some(request_id),
        data: json!({ "errors": errors }),
    };

    HttpResponse::Forbidden().json(response)
}

#[allow(dead_code)]
pub fn response_json_error_404(errors: Vec<String>) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 404,
            message: "Not Found".to_string(),
        },
        request_id: None,
        data: json!({ "errors": errors }),
    };

    HttpResponse::NotFound().json(response)
}

#[allow(dead_code)]
pub fn response_json_error_404_with_request_id(
    errors: Vec<String>,
    request_id: String,
) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 404,
            message: "Not Found".to_string(),
        },
        request_id: Some(request_id),
        data: json!({ "errors": errors }),
    };

    HttpResponse::NotFound().json(response)
}

#[allow(dead_code)]
pub fn response_json_error_500(errors: Vec<String>) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 500,
            message: "Internal Server Error".to_string(),
        },
        request_id: None,
        data: json!({ "errors": errors }),
    };

    HttpResponse::InternalServerError().json(response)
}

#[allow(dead_code)]
pub fn response_json_error_500_with_request_id(
    errors: Vec<String>,
    request_id: String,
) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 500,
            message: "Internal Server Error".to_string(),
        },
        request_id: Some(request_id),
        data: json!({ "errors": errors }),
    };

    HttpResponse::InternalServerError().json(response)
}

pub fn response_redirect_303<T: Serialize>(redirect_uri: &str, query_object: &T) -> HttpResponse {
    let query_json = serde_json::to_value(query_object).unwrap_or(json!({}));
    let mut pairs: Vec<String> = Vec::new();
    if let Value::Object(map) = query_json {
        for (k, v) in map.iter() {
            if let Some(s) = v.as_str() {
                pairs.push(format!(
                    "{}={}",
                    urlencoding::encode(k),
                    urlencoding::encode(s)
                ));
            } else {
                pairs.push(format!(
                    "{}={}",
                    urlencoding::encode(k),
                    urlencoding::encode(&v.to_string())
                ));
            }
        }
    }
    let separator = if redirect_uri.contains('?') { '&' } else { '?' };
    let location = if pairs.is_empty() {
        redirect_uri.to_string()
    } else {
        format!("{}{}{}", redirect_uri, separator, pairs.join("&"))
    };
    HttpResponse::SeeOther()
        .append_header((actix_web::http::header::LOCATION, location))
        .finish()
}

pub fn response_redirect_303_with_set_cookie<T: Serialize>(
    redirect_uri: &str,
    query_object: &T,
    cookie_key: &str,
    cookie_value: &str,
    cookie_expire: usize,
    cookie_is_secure: bool,
    cookie_cors: &[String],
) -> HttpResponse {
    let query_json = serde_json::to_value(query_object).unwrap_or(json!({}));
    let mut pairs: Vec<String> = Vec::new();
    if let Value::Object(map) = query_json {
        for (k, v) in map.iter() {
            if let Some(s) = v.as_str() {
                pairs.push(format!(
                    "{}={}",
                    urlencoding::encode(k),
                    urlencoding::encode(s)
                ));
            } else {
                pairs.push(format!(
                    "{}={}",
                    urlencoding::encode(k),
                    urlencoding::encode(&v.to_string())
                ));
            }
        }
    }
    let separator = if redirect_uri.contains('?') { '&' } else { '?' };
    let location = if pairs.is_empty() {
        redirect_uri.to_string()
    } else {
        format!("{}{}{}", redirect_uri, separator, pairs.join("&"))
    };

    // Cookie builder
    let mut cookie = Cookie::build(cookie_key.to_string(), cookie_value.to_string())
        .path("/")
        .http_only(true)
        .max_age(Duration::seconds(cookie_expire as i64));

    if cookie_is_secure {
        cookie = cookie.secure(true).same_site(SameSite::None);
    } else {
        // dev / http => use Lax (default modern browsers)
        cookie = cookie.same_site(SameSite::Lax);
    }

    let mut resp = HttpResponse::SeeOther();
    resp.append_header((actix_web::http::header::LOCATION, location));
    resp.append_header((
        actix_web::http::header::SET_COOKIE,
        cookie.finish().to_string(),
    ));
    if let Some(first) = cookie_cors.first() {
        resp.append_header((
            actix_web::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            first.clone(),
        ));
        resp.append_header((
            actix_web::http::header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            "true",
        ));
    }
    resp.finish()
}

// UPDATED: allow optional expire (session cookie when None or 0)
pub fn response_redirect_303_with_set_cookie_opt<T: Serialize>(
    redirect_uri: &str,
    query_object: &T,
    cookie_key: &str,
    cookie_value: &str,
    cookie_expire: Option<usize>,
    cookie_is_secure: bool,
    cookie_cors: &[String],
) -> HttpResponse {
    let query_json = serde_json::to_value(query_object).unwrap_or(json!({}));
    let mut pairs: Vec<String> = Vec::new();
    if let Value::Object(map) = query_json {
        for (k, v) in map.iter() {
            if let Some(s) = v.as_str() {
                pairs.push(format!(
                    "{}={}",
                    urlencoding::encode(k),
                    urlencoding::encode(s)
                ));
            } else {
                pairs.push(format!(
                    "{}={}",
                    urlencoding::encode(k),
                    urlencoding::encode(&v.to_string())
                ));
            }
        }
    }
    let separator = if redirect_uri.contains('?') { '&' } else { '?' };
    let location = if pairs.is_empty() {
        redirect_uri.to_string()
    } else {
        format!("{}{}{}", redirect_uri, separator, pairs.join("&"))
    };

    let mut builder = Cookie::build(cookie_key.to_string(), cookie_value.to_string())
        .path("/")
        .http_only(true);
    if let Some(exp) = cookie_expire {
        if exp > 0 {
            builder = builder.max_age(Duration::seconds(exp as i64));
        }
    }
    if cookie_is_secure {
        builder = builder.secure(true).same_site(SameSite::None);
    } else {
        builder = builder.same_site(SameSite::Lax);
    }

    let mut resp = HttpResponse::SeeOther();
    resp.append_header((actix_web::http::header::LOCATION, location));
    resp.append_header((
        actix_web::http::header::SET_COOKIE,
        builder.finish().to_string(),
    ));
    if let Some(first) = cookie_cors.first() {
        resp.append_header((
            actix_web::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            first.clone(),
        ));
        resp.append_header((
            actix_web::http::header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            "true",
        ));
    }
    resp.finish()
}

/// Build a file download response with the given content and filename
pub fn response_file_download(content: &str, filename: &str) -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/plain; charset=utf-8")
        .insert_header((
            actix_web::http::header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        ))
        .body(content.to_string())
}
