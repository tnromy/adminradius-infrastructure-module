-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS openvpn_servers (
	id                       VARCHAR(36) PRIMARY KEY,
	name                     VARCHAR(255) NOT NULL,
	host               VARCHAR(45) NOT NULL,
	port                     INTEGER NOT NULL DEFAULT 1194,
	proto                    VARCHAR(10) NOT NULL DEFAULT 'udp',
	subnet                   VARCHAR(18) NOT NULL DEFAULT '10.8.0.0/24',
	cipher                   VARCHAR(50) DEFAULT 'AES-256-CBC',
	auth_algorithm           VARCHAR(50) NOT NULL DEFAULT 'SHA256',
	tls_key_pem              TEXT,
	tls_key_mode             VARCHAR(10) DEFAULT NULL,
	ca_chain_pem             TEXT NOT NULL,
	certificate_pem          TEXT NOT NULL,
	encrypted_private_key_pem TEXT,
	serial_number            BIGINT,
	expired_at               TIMESTAMPTZ,
	remote_cert_tls_name     VARCHAR(100) NOT NULL DEFAULT 'server',
	crl_distribution_point   TEXT,
	created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(name),
	UNIQUE(host, port),
	UNIQUE(serial_number)
);

-- Trigger for updated_at
CREATE TRIGGER trg_openvpn_servers_updated
BEFORE UPDATE ON openvpn_servers
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index for case-insensitive name searches
CREATE INDEX IF NOT EXISTS idx_openvpn_servers_lower_name ON openvpn_servers(LOWER(name));

-- Index for IP address lookups
CREATE INDEX IF NOT EXISTS idx_openvpn_servers_host ON openvpn_servers(host);

-- Index for serial_number lookups
CREATE INDEX IF NOT EXISTS idx_openvpn_servers_serial_number ON openvpn_servers(serial_number);

-- Seed default OpenVPN server
