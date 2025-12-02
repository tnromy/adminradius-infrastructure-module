use serde::{Deserialize, Serialize};

/// Entity representing the response from creating a server certificate request.
/// This corresponds to the "data" field in the API response for server CSR.
/// Note: Server CSR response does not include reserved_ip_address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaOpenvpnCsrServerEntity {
    pub certificate_request_id: String,
    pub message: String,
    pub requested_at: String,
}
