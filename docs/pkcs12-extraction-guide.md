# PKCS#12 Certificate Extraction Guide

**Target Audience:** AI agents and developers implementing PKCS#12 certificate retrieval and extraction in Rust projects that consume this CA/PKI service.

**Document Purpose:** This guide documents how the `certyid-pki-ca-openvpn` project generates and returns PKCS#12 bundles, and provides detailed instructions for another Rust project to fetch, parse, and extract the contents (intermediate CA, certificate, and private key) as PEM strings.

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [OpenSSL Libraries in Use](#2-openssl-libraries-in-use)
3. [PKCS#12 Generation and Endpoint](#3-pkcs12-generation-and-endpoint)
4. [Extraction in Target Project](#4-extraction-in-target-project)
5. [Required Dependencies for Target Project](#5-required-dependencies-for-target-project)
6. [DER/PEM Conversion Utilities](#6-derpem-conversion-utilities)
7. [Recommended File Structure for Target Project](#7-recommended-file-structure-for-target-project)
8. [Source Files Inspected](#8-source-files-inspected)

---

## 1. Project Context

### Overview

The **certyid-pki-ca-openvpn** project is a Rust-based Certificate Authority (CA) / Public Key Infrastructure (PKI) system specifically designed for managing X.509 certificates for OpenVPN deployments.

- **Status:** Production-ready, fully functional
- **Framework:** Actix-web (v4) with PostgreSQL backend (SQLx v0.7)
- **Cryptography:** OpenSSL-based certificate operations
- **Purpose:** Issue, manage, revoke, and distribute X.509 certificates with full lifecycle support

### Key Characteristics

- Uses **two OpenSSL libraries** collaboratively:
  1. **Rust `openssl` crate** (v0.10): Native Rust wrapper for common operations
  2. **FFI bindings to C OpenSSL**: For advanced features not available in the Rust crate
  
- **PKCS#12 Operations:** Exclusively use the **Rust `openssl` crate** (no FFI needed)
  
- **Project Layout:**
  ```
  src/
    controllers/     # HTTP request handlers
    entities/        # Domain models
    ffi/             # FFI bindings module
    infrastructures/ # Database, HTTP, CA loading
    middlewares/     # Authentication, authorization, logging
    repositories/    # Database access layer
    routes/          # Route definitions
    services/        # Business logic
    utils/           # Helper functions
    validations/     # Input validation
  ```

---

## 2. OpenSSL Libraries in Use

### 2.1 Rust `openssl` Crate (Primary for PKCS#12)

**Cargo Dependency:**
```toml
openssl = "0.10"
```

**Used For:**
- PKCS#12 generation and parsing (`openssl::pkcs12::Pkcs12`)
- X.509 certificate operations (`openssl::x509::X509`)
- Private key operations (`openssl::pkey::PKey`)
- DER ↔ PEM conversions
- Certificate chain building (`openssl::stack::Stack`)
- Encryption/decryption of private keys

**Why:** The Rust crate provides safe, idiomatic Rust APIs for most certificate operations, including complete PKCS#12 support.

### 2.2 C OpenSSL via FFI (For Advanced Features)

**Cargo Dependencies:**
```toml
[build-dependencies]
bindgen = "0.69"

[dependencies]
libc = "0.2"
foreign-types = "0.3"
```

**Build Configuration:**
- **`build.rs`:** Uses `bindgen` to generate Rust bindings from `wrapper.h`
- **`wrapper.h`:** Includes C OpenSSL headers:
  ```c
  #include <openssl/x509.h>
  #include <openssl/x509v3.h>
  #include <openssl/evp.h>
  #include <openssl/pem.h>
  #include <openssl/bio.h>
  #include <openssl/err.h>
  #include <openssl/asn1.h>
  #include <openssl/asn1t.h>
  #include <openssl/ocsp.h>
  ```

**Used For:**
- OCSP request/response parsing (`OCSP_REQUEST`, `OCSP_RESPONSE`)
- CRL advanced operations
- ASN.1 primitive manipulation
- Features not exposed by the Rust crate

**Why:** The Rust `openssl` crate doesn't expose all OpenSSL APIs, particularly for OCSP low-level operations.

**Important:** PKCS#12 operations **do not** require FFI bindings—use the Rust crate only.

---

## 3. PKCS#12 Generation and Endpoint

### 3.1 HTTP Endpoint

**Route:** `GET /certificate/{serial_number}/pkcs12`

**Path Parameters:**
- `serial_number` (i64): Certificate serial number

**Request Body (JSON):**
```json
{
  "passphrase": "secret-passphrase-for-private-key",
  "pkcs12_password": "password-for-pkcs12-bundle"
}
```

**Request Body Fields:**
- `passphrase` (string, required): Password to decrypt the certificate's encrypted private key stored in the database
- `pkcs12_password` (string, required): Password to protect the resulting PKCS#12 bundle (6-36 characters)

**Response Headers:**
```
Content-Type: application/x-pkcs12
Content-Disposition: attachment; filename=cert-{serial_number}.p12
Cache-Control: no-store
```

**Response Body:** Raw PKCS#12 DER bytes (binary)

**Error Responses:**
- `400 Bad Request`: Invalid serial number, certificate revoked, invalid passphrase, validation errors
- `500 Internal Server Error`: Database errors, PKCS#12 generation failures

### 3.2 Implementation Details

**Files Involved:**

1. **Route Definition:** `src/routes/certificate_route.rs`
   ```rust
   web::resource("/certificate/{serial_number}/pkcs12")
       .route(web::get().to(certificate_controller::get_pkcs12))
   ```

2. **Controller:** `src/controllers/certificate_controller.rs`
   - Extracts request ID for logging
   - Parses path parameter and JSON body
   - Validates input via `pkcs12_validation::execute()`
   - Calls service layer
   - Returns binary PKCS#12 or JSON error

3. **Validation:** `src/validations/certificate/pkcs12_validation.rs`
   - Validates `passphrase` is non-empty
   - Validates `pkcs12_password` length (6-36 chars)
   - Checks certificate exists and is not revoked
   - Returns sanitized inputs

4. **Service:** `src/services/get_pkcs12_by_serial_number.rs`
   - Fetches certificate and associated private key from database
   - Verifies certificate is not revoked
   - Builds certificate chain (intermediate CA only, excludes root)
   - Calls utility helper to generate PKCS#12

5. **Utility:** `src/utils/certificate_helper.rs`
   - **Function:** `get_pkcs12()`
   - Parses user certificate PEM
   - Decrypts private key using passphrase
   - Builds certificate chain stack
   - Generates PKCS#12 using `openssl::pkcs12::Pkcs12::builder()`
   - Returns DER bytes

**Repository:** `src/repositories/postgresql/issued_certificate_postgres_repository.rs`
- **Function:** `get_first_by_serial_number()`
- Queries PostgreSQL for certificate with joined private key data
- Returns `IssuedCertificateEntity` with embedded `PrivateKeyEntity`

### 3.3 PKCS#12 Bundle Contents

The returned PKCS#12 file contains:

1. **End-entity Certificate:** The client certificate itself
2. **Intermediate CA Certificate:** The issuing CA certificate (from `ca.pem`)
3. **Private Key:** The decrypted private key corresponding to the certificate

**Important:**
- **Root CA is excluded** per RFC 7292 best practices (clients should have it in their trust store)
- **Chain order:** Only the intermediate CA is included in the chain
- **Friendly name:** Set to `"identity"`
- **Password-protected:** The entire bundle is encrypted with `pkcs12_password`

### 3.4 Code Flow (Vertical Slice)

```
HTTP Request → Route → Controller → Validation → Service → Utility
                                                      ↓
                                                 Repository
                                                      ↓
                                                  Database
```

**Detailed Flow:**

```rust
// 1. Route registration (src/routes/certificate_route.rs)
web::resource("/certificate/{serial_number}/pkcs12")
    .route(web::get().to(certificate_controller::get_pkcs12))

// 2. Controller (src/controllers/certificate_controller.rs)
pub async fn get_pkcs12(
    req: HttpRequest,
    db: web::Data<DatabaseConnection>,
    ca: web::Data<CaEntity>,
    serial_number: web::Path<i64>,
    body: web::Json<Value>,
) -> HttpResponse {
    // Extract serial number
    let serial_number = serial_number.into_inner();
    
    // Validate input
    let (passphrase, pkcs12_password) = 
        pkcs12_validation::execute(db.get_pool().as_ref(), serial_number, &body).await?;
    
    // Generate PKCS#12
    let der = get_pkcs12_by_serial_number::execute(&db, &ca, serial_number, &passphrase, &pkcs12_password).await?;
    
    // Return binary response
    HttpResponse::Ok()
        .insert_header(("Content-Type", "application/x-pkcs12"))
        .insert_header(("Content-Disposition", format!("attachment; filename=cert-{}.p12", serial_number)))
        .body(der)
}

// 3. Service (src/services/get_pkcs12_by_serial_number.rs)
pub async fn execute(
    db_connection: &DatabaseConnection,
    ca: &CaEntity,
    serial_number: i64,
    passphrase: &str,
    pkcs12_password: &str,
) -> Result<Vec<u8>, String> {
    // Fetch certificate with private key
    let user_cert = issued_certificate_postgres_repository::get_first_by_serial_number(&mut *tx, serial_number).await?;
    
    // Build chain (intermediate CA only)
    let chain = vec![ca.ca_cert.clone()];
    
    // Generate PKCS#12 DER
    let der = certificate_helper::get_pkcs12(
        &chain,
        &user_cert.certificate_pem,
        &private_key_entity.encrypted_private_key_pem,
        passphrase,
        pkcs12_password,
    )?;
    
    Ok(der)
}

// 4. Utility (src/utils/certificate_helper.rs)
pub fn get_pkcs12(
    chain: &[X509],
    user_cert_pem: &str,
    encrypted_user_key_pem: &str,
    passphrase: &str,
    pkcs12_password: &str,
) -> Result<Vec<u8>, String> {
    // Parse certificate
    let user_cert = X509::from_pem(user_cert_pem.as_bytes())?;
    
    // Decrypt private key
    let user_key = PKey::private_key_from_pem_passphrase(
        encrypted_user_key_pem.as_bytes(),
        passphrase.as_bytes(),
    )?;
    
    // Build chain stack
    let mut chain_stack = Stack::new()?;
    for ca_cert in chain {
        chain_stack.push(ca_cert.clone())?;
    }
    
    // Build PKCS#12
    let mut builder = Pkcs12::builder();
    builder
        .name("identity")
        .pkey(&user_key)
        .cert(&user_cert);
    if chain_stack.len() > 0 {
        builder.ca(chain_stack);
    }
    
    let pkcs12 = builder.build2(pkcs12_password)?;
    pkcs12.to_der()
}
```

**Library Used:** All PKCS#12 operations use the **Rust `openssl` crate** exclusively.

---

## 4. Extraction in Target Project

### 4.1 Overview

The target project needs to:
1. Make HTTP GET request to the endpoint
2. Receive binary PKCS#12 DER data
3. Parse PKCS#12 using the password
4. Extract intermediate CA(s), end-entity certificate, and private key
5. Convert each to PEM format
6. Optionally decrypt/remove password protection from private key

**Library Choice:** Use the **Rust `openssl` crate** exclusively (no FFI needed).

### 4.2 Step-by-Step Implementation

#### Step 1: Make HTTP Request

**Dependencies:**
```toml
[dependencies]
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
tokio = { version = "1", features = ["full"] }
serde_json = "1.0"
```

**Example Code:**
```rust
use reqwest;
use serde_json::json;

async fn fetch_pkcs12(
    base_url: &str,
    serial_number: i64,
    passphrase: &str,
    pkcs12_password: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let url = format!("{}/certificate/{}/pkcs12", base_url, serial_number);
    
    let request_body = json!({
        "passphrase": passphrase,
        "pkcs12_password": pkcs12_password
    });
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .json(&request_body)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        return Err(format!("HTTP error: {}", error_text).into());
    }
    
    let pkcs12_bytes = response.bytes().await?;
    Ok(pkcs12_bytes.to_vec())
}
```

**Notes:**
- Use `.get()` HTTP method (not POST)
- Include JSON body with both passwords
- Response is `application/x-pkcs12` binary data
- Add appropriate error handling for your use case

#### Step 2: Parse PKCS#12

**Dependencies:**
```toml
[dependencies]
openssl = "0.10"
```

**Example Code:**
```rust
use openssl::pkcs12::Pkcs12;

fn parse_pkcs12(pkcs12_der: &[u8], password: &str) -> Result<openssl::pkcs12::ParsedPkcs12, String> {
    // Parse PKCS#12 from DER
    let pkcs12 = Pkcs12::from_der(pkcs12_der)
        .map_err(|e| format!("Failed to parse PKCS#12 DER: {}", e))?;
    
    // Decrypt and parse with password
    let parsed = pkcs12.parse2(password)
        .map_err(|e| format!("Failed to decrypt PKCS#12 (invalid password?): {}", e))?;
    
    Ok(parsed)
}
```

**Notes:**
- Use `parse2()` (not deprecated `parse()`) for modern API
- Returns `ParsedPkcs12` struct with fields:
  - `cert`: Option<X509> (end-entity certificate)
  - `pkey`: Option<PKey<Private>> (private key)
  - `chain`: Option<Stack<X509>> (CA certificates)

#### Step 3: Extract Components

**Example Code:**
```rust
use openssl::x509::X509;
use openssl::pkey::{PKey, Private};
use openssl::stack::Stack;

struct ExtractedPkcs12 {
    certificate: X509,
    private_key: PKey<Private>,
    ca_chain: Vec<X509>,
}

fn extract_components(parsed: openssl::pkcs12::ParsedPkcs12) -> Result<ExtractedPkcs12, String> {
    // Extract certificate
    let certificate = parsed.cert
        .ok_or("PKCS#12 does not contain a certificate")?;
    
    // Extract private key
    let private_key = parsed.pkey
        .ok_or("PKCS#12 does not contain a private key")?;
    
    // Extract CA chain (may be empty)
    let ca_chain: Vec<X509> = match parsed.chain {
        Some(stack) => {
            let mut certs = Vec::new();
            for i in 0..stack.len() {
                if let Some(cert) = stack.get(i) {
                    certs.push(cert.to_owned());
                }
            }
            certs
        },
        None => Vec::new(),
    };
    
    Ok(ExtractedPkcs12 {
        certificate,
        private_key,
        ca_chain,
    })
}
```

#### Step 4: Convert to PEM Strings

**Example Code:**
```rust
fn certificate_to_pem(cert: &X509) -> Result<String, String> {
    let pem_bytes = cert.to_pem()
        .map_err(|e| format!("Failed to convert certificate to PEM: {}", e))?;
    String::from_utf8(pem_bytes)
        .map_err(|e| format!("Failed to convert PEM bytes to string: {}", e))
}

fn private_key_to_pem(key: &PKey<Private>) -> Result<String, String> {
    // Export as unencrypted PKCS#8 PEM
    let pem_bytes = key.private_key_to_pem_pkcs8()
        .map_err(|e| format!("Failed to convert private key to PEM: {}", e))?;
    String::from_utf8(pem_bytes)
        .map_err(|e| format!("Failed to convert PEM bytes to string: {}", e))
}

fn ca_chain_to_pem(chain: &[X509]) -> Result<Vec<String>, String> {
    chain.iter()
        .map(|cert| certificate_to_pem(cert))
        .collect()
}
```

**Notes:**
- `private_key_to_pem_pkcs8()`: Exports **unencrypted** PKCS#8 private key
- For encrypted output, use `private_key_to_pem_pkcs8_passphrase(cipher, password)`
- PEM format includes headers like `-----BEGIN CERTIFICATE-----`

#### Step 5: Complete Example

**Full Integration:**
```rust
use openssl::pkcs12::Pkcs12;
use openssl::x509::X509;
use openssl::pkey::{PKey, Private};

pub struct Pkcs12Contents {
    pub certificate_pem: String,
    pub private_key_pem: String,
    pub ca_chain_pem: Vec<String>,
}

pub async fn get_and_extract_pkcs12(
    ca_base_url: &str,
    serial_number: i64,
    passphrase: &str,
    pkcs12_password: &str,
) -> Result<Pkcs12Contents, Box<dyn std::error::Error>> {
    // Step 1: Fetch PKCS#12 from endpoint
    let pkcs12_der = fetch_pkcs12(ca_base_url, serial_number, passphrase, pkcs12_password).await?;
    
    // Step 2: Parse PKCS#12
    let pkcs12 = Pkcs12::from_der(&pkcs12_der)
        .map_err(|e| format!("Failed to parse PKCS#12: {}", e))?;
    
    let parsed = pkcs12.parse2(pkcs12_password)
        .map_err(|e| format!("Failed to decrypt PKCS#12: {}", e))?;
    
    // Step 3: Extract components
    let certificate = parsed.cert
        .ok_or("No certificate in PKCS#12")?;
    
    let private_key = parsed.pkey
        .ok_or("No private key in PKCS#12")?;
    
    let ca_chain: Vec<X509> = match parsed.chain {
        Some(stack) => (0..stack.len())
            .filter_map(|i| stack.get(i).map(|c| c.to_owned()))
            .collect(),
        None => Vec::new(),
    };
    
    // Step 4: Convert to PEM
    let certificate_pem = String::from_utf8(certificate.to_pem()?)
        .map_err(|e| format!("Invalid UTF-8 in certificate PEM: {}", e))?;
    
    let private_key_pem = String::from_utf8(private_key.private_key_to_pem_pkcs8()?)
        .map_err(|e| format!("Invalid UTF-8 in private key PEM: {}", e))?;
    
    let ca_chain_pem: Result<Vec<String>, Box<dyn std::error::Error>> = ca_chain.iter()
        .map(|cert| {
            String::from_utf8(cert.to_pem()?)
                .map_err(|e| format!("Invalid UTF-8 in CA cert PEM: {}", e).into())
        })
        .collect();
    
    Ok(Pkcs12Contents {
        certificate_pem,
        private_key_pem,
        ca_chain_pem: ca_chain_pem?,
    })
}
```

### 4.3 Why Use Rust `openssl` Crate (Not FFI)

**Rationale:**

1. **Complete API Support:** The `openssl` crate provides full PKCS#12 support:
   - `Pkcs12::from_der()` for parsing
   - `Pkcs12::parse2()` for decryption
   - `ParsedPkcs12` struct for accessing components
   - All conversion methods (to_pem, from_pem, etc.)

2. **Type Safety:** Rust crate provides type-safe APIs vs. raw C pointers

3. **No Build Complexity:** No need for `bindgen`, `build.rs`, or `wrapper.h`

4. **Proven Path:** The source project uses Rust crate for PKCS#12 generation—use same for parsing

5. **Memory Safety:** Automatic memory management vs. manual `free()` calls with FFI

**When to Use FFI Instead:**
- Only if you need OpenSSL APIs not exposed by the Rust crate
- For PKCS#12 operations, FFI is **not required**

---

## 5. Required Dependencies for Target Project

### 5.1 Cargo.toml

**Minimal PKCS#12 Support:**
```toml
[dependencies]
openssl = "0.10"
```

**With HTTP Client:**
```toml
[dependencies]
openssl = "0.10"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

**With Error Handling:**
```toml
[dependencies]
openssl = "0.10"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1"
thiserror = "1"
```

### 5.2 No Build Script Required

**Important:** For PKCS#12 operations using the Rust `openssl` crate, you do **not** need:
- `build.rs`
- `wrapper.h`
- `bindgen` in `[build-dependencies]`
- `libc` or `foreign-types` (unless using other FFI)

### 5.3 OpenSSL System Library

**Platform Requirements:**

**Linux (Debian/Ubuntu):**
```bash
sudo apt-get install libssl-dev pkg-config
```

**Linux (RedHat/Fedora):**
```bash
sudo yum install openssl-devel
```

**macOS:**
```bash
brew install openssl@3
# May need to set environment variables:
export OPENSSL_DIR=/usr/local/opt/openssl@3
```

**Windows:**
- Use pre-built OpenSSL binaries
- Or build from source
- Set `OPENSSL_DIR` environment variable

**Docker:**
```dockerfile
FROM rust:1.75 as builder
RUN apt-get update && apt-get install -y \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*
```

---

## 6. DER/PEM Conversion Utilities

### 6.1 Existing Utilities in Source Project

The source project provides utilities in `src/utils/der_helper.rs` and `src/utils/certificate_helper.rs`:

#### Certificate Conversions (Rust `openssl` crate)

**File:** `src/utils/der_helper.rs`

```rust
use openssl::x509::X509;

/// Convert Certificate DER bytes to PEM format
pub fn cert_der_to_pem(der: &[u8]) -> Result<Vec<u8>, String> {
    let cert = X509::from_der(der)
        .map_err(|e| format!("Failed to parse certificate DER: {}", e))?;
    cert.to_pem().map_err(|e| format!("Failed to convert certificate to PEM: {}", e))
}

/// Convert Certificate PEM bytes to DER format
pub fn cert_pem_to_der(pem: &[u8]) -> Result<Vec<u8>, String> {
    let cert = X509::from_pem(pem)
        .map_err(|e| format!("Failed to parse certificate PEM: {}", e))?;
    cert.to_der().map_err(|e| format!("Failed to convert certificate to DER: {}", e))
}
```

**File:** `src/utils/certificate_helper.rs`

```rust
use openssl::x509::X509;

/// Convert a certificate PEM string to DER bytes
pub fn pem_to_der_converter(pem: &str) -> Result<Vec<u8>, String> {
    let x = X509::from_pem(pem.as_bytes())
        .map_err(|e| format!("Failed to parse PEM as X509: {e}"))?;
    x.to_der().map_err(|e| format!("Failed to convert X509 to DER: {e}"))
}
```

**Library Used:** Rust `openssl` crate

**Usage Example:**
```rust
// PEM string to DER bytes
let der_bytes = cert_pem_to_der(pem_string.as_bytes())?;

// DER bytes to PEM string
let pem_bytes = cert_der_to_pem(&der_bytes)?;
let pem_string = String::from_utf8(pem_bytes)?;

// Or using certificate_helper
let der_bytes = pem_to_der_converter(&pem_string)?;
```

#### CRL Conversions (Rust `openssl` crate)

**File:** `src/utils/der_helper.rs`

```rust
use openssl::x509::X509Crl;

/// Convert CRL DER bytes to PEM format
pub fn crl_der_to_pem(der: &[u8]) -> Result<Vec<u8>, String> {
    let crl = X509Crl::from_der(der)
        .map_err(|e| format!("Failed to parse CRL DER: {}", e))?;
    crl.to_pem().map_err(|e| format!("Failed to convert CRL to PEM: {}", e))
}

/// Convert CRL PEM bytes to DER format
pub fn crl_pem_to_der(pem: &[u8]) -> Result<Vec<u8>, String> {
    let crl = X509Crl::from_pem(pem)
        .map_err(|e| format!("Failed to parse CRL PEM: {}", e))?;
    crl.to_der().map_err(|e| format!("Failed to convert CRL to DER: {}", e))
}
```

**Library Used:** Rust `openssl` crate

#### OCSP Request Decoding (FFI to C OpenSSL)

**File:** `src/utils/der_helper.rs`

```rust
use crate::ffi;
use crate::entities::ocsp_request_entity::OcspRequestEntity;

/// Decode OCSP request DER using OpenSSL OCSP APIs via FFI
pub fn ocsp_request_der_decode(der: &[u8]) -> Result<OcspRequestEntity, String> {
    unsafe {
        let mut p = der.as_ptr();
        let len = der.len() as libc::c_long;
        let req = ffi::d2i_OCSP_REQUEST(std::ptr::null_mut(), &mut p, len);
        if req.is_null() {
            return Err("Failed to parse OCSP_REQUEST".to_string());
        }
        // ... (parsing logic omitted for brevity)
        ffi::OCSP_REQUEST_free(req);
        result
    }
}
```

**Library Used:** FFI binding to C OpenSSL (required because Rust `openssl` crate lacks OCSP request parsing)

### 6.2 Private Key Operations

**Private Key Decryption (Rust `openssl` crate):**

**File:** Multiple utilities in `src/utils/`

```rust
use openssl::pkey::PKey;

// Decrypt encrypted private key with passphrase
let private_key = PKey::private_key_from_pem_passphrase(
    encrypted_pem.as_bytes(),
    passphrase.as_bytes(),
).map_err(|e| format!("Failed to decrypt private key: {}", e))?;

// Convert to unencrypted PEM
let unencrypted_pem = private_key.private_key_to_pem_pkcs8()
    .map_err(|e| format!("Failed to export private key: {}", e))?;

// Or re-encrypt with different password
use openssl::symm::Cipher;
let encrypted_pem = private_key.private_key_to_pem_pkcs8_passphrase(
    Cipher::aes_256_cbc(),
    new_password.as_bytes(),
).map_err(|e| format!("Failed to encrypt private key: {}", e))?;
```

**Library Used:** Rust `openssl` crate

### 6.3 Third-Party Crates Used

**Beyond `openssl` crate, the source project uses:**

- **`base64` (v0.22):** Base64 encoding/decoding (not for PEM, but for OCSP GET requests)
  
  **File:** `src/utils/base64_helper.rs`
  ```rust
  use base64::{engine::general_purpose, Engine as _};
  
  pub fn decode(input: &str) -> Result<Vec<u8>, String> {
      general_purpose::URL_SAFE_NO_PAD.decode(input)
          .or_else(|_| general_purpose::STANDARD.decode(input))
          .map_err(|e| format!("Failed to decode base64: {}", e))
  }
  ```

- **`hex` (v0.4):** Hexadecimal encoding (for fingerprints, hashes)

- **No `pem` crate:** OpenSSL's `to_pem()` methods handle PEM encoding internally

**Target Project Recommendations:**
- Use Rust `openssl` crate's built-in PEM methods
- Only add `base64` if you need URL-safe encoding for other purposes
- No additional PEM/DER crates required

### 6.4 Complete Conversion Reference

**Certificate Formats:**

| From      | To   | Function                                  | Library       |
|-----------|------|-------------------------------------------|---------------|
| PEM str   | DER  | `X509::from_pem(pem).to_der()`           | openssl crate |
| DER bytes | PEM  | `X509::from_der(der).to_pem()`           | openssl crate |
| PEM bytes | DER  | `X509::from_pem(pem).to_der()`           | openssl crate |
| DER bytes | PEM str | `String::from_utf8(X509::from_der(der).to_pem()?)` | openssl crate |

**Private Key Formats:**

| From                  | To          | Function                                 | Library       |
|-----------------------|-------------|------------------------------------------|---------------|
| Encrypted PEM + pass  | Decrypted   | `PKey::private_key_from_pem_passphrase()` | openssl crate |
| Decrypted PKey        | PEM (plain) | `pkey.private_key_to_pem_pkcs8()`        | openssl crate |
| Decrypted PKey        | PEM (enc)   | `pkey.private_key_to_pem_pkcs8_passphrase()` | openssl crate |
| Decrypted PKey        | DER         | `pkey.private_key_to_der()`              | openssl crate |

---

## 7. Recommended File Structure for Target Project

### 7.1 File Organization

Following the source project's conventions:

```
target-project/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── entities/
│   │   ├── mod.rs
│   │   ├── pkcs12_payload.rs       # Request/response structs
│   │   └── certificate_bundle.rs   # Extracted cert + key + chain
│   ├── services/
│   │   ├── mod.rs
│   │   └── fetch_certificate.rs    # Business logic for fetching
│   └── utils/
│       ├── mod.rs
│       ├── pkcs12_helper.rs        # PKCS#12 parsing and extraction
│       ├── http_client.rs          # HTTP request wrapper
│       └── certificate_helper.rs   # PEM/DER conversions (if needed)
```

### 7.2 Suggested File Contents

#### `src/entities/pkcs12_payload.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct Pkcs12Request {
    pub passphrase: String,
    pub pkcs12_password: String,
}

#[derive(Debug)]
pub struct Pkcs12Bundle {
    pub certificate_pem: String,
    pub private_key_pem: String,
    pub ca_chain_pem: Vec<String>,
}
```

#### `src/entities/certificate_bundle.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateBundle {
    pub serial_number: i64,
    pub certificate: String,      // PEM
    pub private_key: String,       // PEM (unencrypted)
    pub intermediate_ca: String,   // PEM
}
```

#### `src/utils/pkcs12_helper.rs`

```rust
use openssl::pkcs12::Pkcs12;
use openssl::x509::X509;
use openssl::pkey::{PKey, Private};

pub struct Pkcs12Contents {
    pub certificate_pem: String,
    pub private_key_pem: String,
    pub ca_chain_pem: Vec<String>,
}

/// Parse and extract PKCS#12 bundle
pub fn extract_pkcs12(pkcs12_der: &[u8], password: &str) -> Result<Pkcs12Contents, String> {
    // Parse PKCS#12
    let pkcs12 = Pkcs12::from_der(pkcs12_der)
        .map_err(|e| format!("Failed to parse PKCS#12: {}", e))?;
    
    let parsed = pkcs12.parse2(password)
        .map_err(|e| format!("Failed to decrypt PKCS#12: {}", e))?;
    
    // Extract certificate
    let certificate = parsed.cert
        .ok_or("No certificate in PKCS#12")?;
    let certificate_pem = String::from_utf8(certificate.to_pem()?)
        .map_err(|e| format!("Invalid certificate PEM: {}", e))?;
    
    // Extract private key
    let private_key = parsed.pkey
        .ok_or("No private key in PKCS#12")?;
    let private_key_pem = String::from_utf8(private_key.private_key_to_pem_pkcs8()?)
        .map_err(|e| format!("Invalid private key PEM: {}", e))?;
    
    // Extract CA chain
    let ca_chain_pem: Result<Vec<String>, String> = match parsed.chain {
        Some(stack) => (0..stack.len())
            .filter_map(|i| stack.get(i))
            .map(|cert| {
                String::from_utf8(cert.to_pem()?)
                    .map_err(|e| format!("Invalid CA cert PEM: {}", e))
            })
            .collect(),
        None => Ok(Vec::new()),
    };
    
    Ok(Pkcs12Contents {
        certificate_pem,
        private_key_pem,
        ca_chain_pem: ca_chain_pem?,
    })
}
```

#### `src/utils/http_client.rs`

```rust
use reqwest;
use serde_json::json;

pub async fn fetch_pkcs12_from_ca(
    ca_base_url: &str,
    serial_number: i64,
    passphrase: &str,
    pkcs12_password: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let url = format!("{}/certificate/{}/pkcs12", ca_base_url, serial_number);
    
    let body = json!({
        "passphrase": passphrase,
        "pkcs12_password": pkcs12_password
    });
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    
    let response = client
        .get(&url)
        .json(&body)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await?;
        return Err(format!("HTTP {} error: {}", status, error_body).into());
    }
    
    Ok(response.bytes().await?.to_vec())
}
```

#### `src/services/fetch_certificate.rs`

```rust
use crate::entities::certificate_bundle::CertificateBundle;
use crate::utils::{http_client, pkcs12_helper};

pub async fn fetch_and_extract_certificate(
    ca_base_url: &str,
    serial_number: i64,
    passphrase: &str,
    pkcs12_password: &str,
) -> Result<CertificateBundle, Box<dyn std::error::Error>> {
    // Fetch PKCS#12 from CA
    let pkcs12_der = http_client::fetch_pkcs12_from_ca(
        ca_base_url,
        serial_number,
        passphrase,
        pkcs12_password,
    ).await?;
    
    // Extract contents
    let contents = pkcs12_helper::extract_pkcs12(&pkcs12_der, pkcs12_password)?;
    
    // Assume first CA in chain is intermediate
    let intermediate_ca = contents.ca_chain_pem
        .first()
        .ok_or("No intermediate CA in PKCS#12")?
        .clone();
    
    Ok(CertificateBundle {
        serial_number,
        certificate: contents.certificate_pem,
        private_key: contents.private_key_pem,
        intermediate_ca,
    })
}
```

### 7.3 Module Registration

#### `src/utils/mod.rs`

```rust
pub mod pkcs12_helper;
pub mod http_client;
pub mod certificate_helper;  // Optional, for additional conversions
```

#### `src/entities/mod.rs`

```rust
pub mod pkcs12_payload;
pub mod certificate_bundle;
```

#### `src/services/mod.rs`

```rust
pub mod fetch_certificate;
```

#### `src/main.rs`

```rust
mod entities;
mod services;
mod utils;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let bundle = services::fetch_certificate::fetch_and_extract_certificate(
        "https://ca.example.com/document-sign",
        1234567890,
        "my-secret-passphrase",
        "pkcs12-password",
    ).await?;
    
    println!("Certificate: {}", bundle.certificate);
    println!("Private Key: {}", bundle.private_key);
    println!("Intermediate CA: {}", bundle.intermediate_ca);
    
    Ok(())
}
```

---

## 8. Source Files Inspected

### 8.1 Complete File List

The following files in the `certyid-pki-ca-openvpn` project were inspected to create this guide:

#### Core PKCS#12 Flow

1. **`src/routes/certificate_route.rs`**
   - Defines GET route `/certificate/{serial_number}/pkcs12`
   - Maps route to controller

2. **`src/controllers/certificate_controller.rs`**
   - Function: `get_pkcs12()`
   - Handles HTTP request/response
   - Extracts path params and JSON body
   - Validates input
   - Returns binary PKCS#12 or JSON error

3. **`src/validations/certificate/pkcs12_validation.rs`**
   - Function: `execute()`
   - Validates `passphrase` and `pkcs12_password` fields
   - Checks certificate exists and is not revoked
   - Returns sanitized inputs

4. **`src/services/get_pkcs12_by_serial_number.rs`**
   - Function: `execute()`
   - Fetches certificate from database
   - Verifies certificate is not revoked
   - Builds certificate chain
   - Calls utility to generate PKCS#12 DER

5. **`src/utils/certificate_helper.rs`**
   - Function: `get_pkcs12()`
   - Parses user certificate PEM
   - Decrypts private key
   - Builds certificate chain stack
   - Generates PKCS#12 using Rust `openssl` crate
   - Returns DER bytes

6. **`src/repositories/postgresql/issued_certificate_postgres_repository.rs`**
   - Function: `get_first_by_serial_number()`
   - Queries database with JOIN to fetch certificate and private key
   - Returns `IssuedCertificateEntity` with embedded `PrivateKeyEntity`

#### Supporting Files

7. **`src/entities/issued_certificate_entity.rs`**
   - Defines `IssuedCertificateEntity` struct
   - Contains certificate metadata and PEM data
   - Includes optional joined `PrivateKeyEntity`

8. **`src/entities/private_key_entity.rs`**
   - Defines `PrivateKeyEntity` struct
   - Contains encrypted private key PEM

9. **`src/entities/ca_entity.rs`**
   - Defines `CaEntity` struct
   - Contains root CA, intermediate CA, and CA private key
   - Used for signing and chain building

10. **`src/utils/der_helper.rs`**
    - Functions: `cert_der_to_pem()`, `cert_pem_to_der()`, `crl_der_to_pem()`, `crl_pem_to_der()`
    - Uses Rust `openssl` crate for certificate/CRL conversions
    - Function: `ocsp_request_der_decode()`
    - Uses FFI for OCSP request parsing

11. **`src/utils/base64_helper.rs`**
    - Function: `decode()`
    - Base64 decoding with multiple format support
    - Uses `base64` crate (v0.22)

12. **`src/utils/generate_private_key_helper.rs`**
    - Function: `generate()`
    - Generates RSA private keys
    - Encrypts with passphrase using Rust `openssl` crate

13. **`src/utils/certificate_validation_helper.rs`**
    - Function: `validate_intermediate_ca()`
    - Validates CA certificate chain
    - Uses Rust `openssl` crate

#### Build and Configuration

14. **`build.rs`**
    - Configures `bindgen` to generate FFI bindings
    - Links against system OpenSSL libraries
    - Defines allowlist for C OpenSSL functions/types
    - Outputs to `OUT_DIR/ffi_openssl_crl.rs`

15. **`wrapper.h`**
    - Includes C OpenSSL headers for FFI binding
    - Headers: `x509.h`, `x509v3.h`, `evp.h`, `pem.h`, `bio.h`, `err.h`, `asn1.h`, `asn1t.h`, `ocsp.h`

16. **`src/ffi/mod.rs`**
    - Includes generated FFI bindings
    - Allows non-standard naming conventions

17. **`Cargo.toml`**
    - Dependencies: `openssl = "0.10"`, `base64 = "0.22"`, etc.
    - Build dependencies: `bindgen = "0.69"`
    - Runtime dependencies: `actix-web`, `sqlx`, `tokio`, etc.

18. **`src/infrastructures/load_ca.rs`**
    - Function: `load()`
    - Loads CA assets at startup
    - Embeds root CA at compile-time
    - Loads intermediate CA and private key at runtime
    - Validates certificate chain

19. **`src/infrastructures/http.rs`**
    - Function: `run_server()`
    - Configures Actix-web server
    - Registers all routes including PKCS#12 endpoint
    - Sets up middleware stack

20. **`src/main.rs`**
    - Entry point
    - Loads CA assets
    - Starts HTTP server

### 8.2 Summary of File Roles

| File | Role | Library Used |
|------|------|--------------|
| `routes/certificate_route.rs` | Route definition | Actix-web |
| `controllers/certificate_controller.rs` | HTTP handler | Actix-web |
| `validations/certificate/pkcs12_validation.rs` | Input validation | SQLx |
| `services/get_pkcs12_by_serial_number.rs` | Business logic | Rust `openssl` crate |
| `utils/certificate_helper.rs` | PKCS#12 generation | Rust `openssl` crate |
| `repositories/postgresql/issued_certificate_postgres_repository.rs` | Database access | SQLx |
| `entities/issued_certificate_entity.rs` | Domain model | Serde |
| `entities/private_key_entity.rs` | Domain model | Serde |
| `entities/ca_entity.rs` | CA configuration | Rust `openssl` crate |
| `utils/der_helper.rs` | Format conversions | Rust `openssl` crate + FFI (OCSP only) |
| `utils/base64_helper.rs` | Base64 encoding | `base64` crate |
| `utils/generate_private_key_helper.rs` | Key generation | Rust `openssl` crate |
| `utils/certificate_validation_helper.rs` | Certificate validation | Rust `openssl` crate |
| `build.rs` | FFI binding generation | `bindgen` |
| `wrapper.h` | C headers for FFI | N/A |
| `ffi/mod.rs` | FFI bindings module | Generated by bindgen |

### 8.3 Key Findings

1. **PKCS#12 operations exclusively use Rust `openssl` crate**—no FFI required

2. **FFI bindings are only used for OCSP and advanced CRL operations** not available in Rust crate

3. **All PEM/DER conversions for certificates use Rust `openssl` crate**

4. **Private key encryption/decryption uses Rust `openssl` crate**

5. **No third-party `pem` or `pkcs12` helper crates**—OpenSSL provides all functionality

6. **Target project can rely solely on Rust `openssl` crate for PKCS#12 extraction**

---

## Additional Notes

### Security Considerations

1. **Password Security:**
   - Both `passphrase` and `pkcs12_password` are transmitted in JSON body
   - Use HTTPS in production
   - Passwords are sanitized (XSS protection) but not validated for strength

2. **Certificate Revocation:**
   - Endpoint checks if certificate is revoked before returning PKCS#12
   - Target project should also verify certificate status (OCSP/CRL)

3. **Private Key Protection:**
   - Private key is decrypted server-side, then re-encrypted in PKCS#12
   - Target project receives unencrypted private key after PKCS#12 parsing
   - Store extracted private keys securely (encrypted at rest)

4. **Token Authentication:**
   - Source project uses JWT authentication (not shown in PKCS#12 flow)
   - Target project must handle authentication headers if required

### Error Handling

**Common Errors:**

- `Invalid serial number`: Certificate doesn't exist
- `Certificate is revoked`: Cannot export revoked certificates
- `Invalid passphrase`: Wrong password for private key decryption
- `Failed to decrypt PKCS#12`: Wrong PKCS#12 password
- `No certificate in PKCS#12`: Malformed PKCS#12 structure
- `No private key in PKCS#12`: PKCS#12 missing private key

**Best Practices:**
- Validate serial number exists before calling endpoint
- Use try/catch or Result types for error propagation
- Log errors for debugging (avoid logging passwords)
- Provide user-friendly error messages

### Performance Considerations

1. **Database Query:** Single query with JOIN fetches certificate + private key
2. **Cryptographic Operations:** PKCS#12 generation is CPU-intensive
3. **Network Transfer:** PKCS#12 files are typically 2-5 KB (base64-encoded ~4-7 KB)
4. **Caching:** Consider caching PKCS#12 bundles if requested frequently (with proper expiration)

### Testing Recommendations

**Unit Tests:**
- Test PKCS#12 parsing with valid/invalid passwords
- Test extraction of each component
- Test PEM conversion functions

**Integration Tests:**
- Test full flow: fetch → parse → extract → verify
- Test error cases (revoked cert, wrong password, etc.)
- Test with various certificate types

**Example Test:**
```rust
#[tokio::test]
async fn test_fetch_and_extract_pkcs12() {
    let bundle = fetch_and_extract_certificate(
        "https://ca-test.example.com",
        1234567890,
        "test-passphrase",
        "test-pkcs12-pass",
    ).await.unwrap();
    
    assert!(bundle.certificate_pem.contains("-----BEGIN CERTIFICATE-----"));
    assert!(bundle.private_key_pem.contains("-----BEGIN PRIVATE KEY-----"));
    assert!(bundle.intermediate_ca.contains("-----BEGIN CERTIFICATE-----"));
}
```

---

## Conclusion

This guide provides comprehensive information for implementing PKCS#12 certificate retrieval and extraction in a Rust project that consumes the `certyid-pki-ca-openvpn` CA service.

**Key Takeaways:**

1. **Use Rust `openssl` crate exclusively for PKCS#12 operations**—no FFI needed
2. **Endpoint returns binary PKCS#12 DER** containing cert + private key + intermediate CA
3. **Parse with `Pkcs12::from_der()` and `parse2()`** from `openssl` crate
4. **Extract components and convert to PEM** using built-in methods
5. **Follow source project's file structure conventions** for consistency
6. **No build script required** for PKCS#12 operations

**Next Steps:**

1. Add `openssl = "0.10"` and `reqwest` to target project's `Cargo.toml`
2. Create `utils/pkcs12_helper.rs` with extraction logic
3. Create `utils/http_client.rs` with fetch logic
4. Create `services/fetch_certificate.rs` to orchestrate the flow
5. Write unit and integration tests
6. Handle errors gracefully
7. Secure private key storage in target application

For questions or clarifications, refer to the source files listed in [Section 8](#8-source-files-inspected).

---

**Document Version:** 1.0  
**Date:** December 3, 2025  
**Source Project:** certyid-pki-ca-openvpn (tnromy/certyid-pki-ca-openvpn)  
**Target Audience:** AI agents and Rust developers
