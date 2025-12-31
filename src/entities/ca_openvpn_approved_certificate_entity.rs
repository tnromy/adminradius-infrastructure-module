use serde::{Deserialize, Serialize};

/// Entity representing the response from approving a certificate request.
/// This corresponds to the "data" field in the API response for CSR approval.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaOpenvpnApprovedCertificateEntity {
    pub certificate_pem: String,
    pub cn: String,
    pub expired_at: String,
    pub issued_at: String,
    pub message: String,
    pub serial_number: i64,
}
