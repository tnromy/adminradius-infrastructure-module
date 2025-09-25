use actix_web::HttpResponse;
use serde::Serialize;
use serde_json::{json, Value};

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

pub fn response_json_error_400(errors: Vec<String>) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 400,
            message: "Bad Request".to_string(),
        },
        request_id: None,
        data: json!({ "errors": errors }),
    };

    HttpResponse::BadRequest().json(response)
}

pub fn response_json_error_400_with_request_id(errors: Vec<String>, request_id: String) -> HttpResponse {
    let response = JsonResponse {
        status: ResponseStatus {
            code: 400,
            message: "Bad Request".to_string(),
        },
        request_id: Some(request_id),
        data: json!({ "errors": errors }),
    };

    HttpResponse::BadRequest().json(response)
}

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

pub fn response_json_error_404_with_request_id(errors: Vec<String>, request_id: String) -> HttpResponse {
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

pub fn response_json_error_500_with_request_id(errors: Vec<String>, request_id: String) -> HttpResponse {
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