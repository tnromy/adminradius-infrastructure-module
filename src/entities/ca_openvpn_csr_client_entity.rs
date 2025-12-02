use serde::{Deserialize, Serialize};

/// Entity representing the response from creating a client certificate request.
/// This corresponds to the "data" field in the API response for client CSR.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaOpenvpnCsrClientEntity {
    pub certificate_request_id: String,
    pub message: String,
    pub requested_at: String,
    pub reserved_ip_address: String,
}
