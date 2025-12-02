-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS openvpn_clients (
	id                   VARCHAR(36) PRIMARY KEY,
	server_id            VARCHAR(36) NOT NULL REFERENCES openvpn_servers(id) ON UPDATE CASCADE ON DELETE CASCADE,
	cn                   VARCHAR(64) NOT NULL,
	reserved_ip_address  VARCHAR(45),
	certificate_pem      TEXT NOT NULL,
	encrypted_private_key_pem      TEXT NOT NULL,
	revoked_at           TIMESTAMPTZ DEFAULT NULL,
	expired_at           TIMESTAMPTZ NOT NULL,
	created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(server_id, cn)
);

-- Trigger for updated_at
CREATE TRIGGER trg_openvpn_clients_updated
BEFORE UPDATE ON openvpn_clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index on server_id for filtering clients by server
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_server_id ON openvpn_clients(server_id);

-- Index on cn for lookups
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_cn ON openvpn_clients(cn);

-- Index for reserved IP address lookups
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_reserved_ip ON openvpn_clients(reserved_ip_address) WHERE reserved_ip_address IS NOT NULL;

-- Index for finding revoked clients
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_revoked ON openvpn_clients(revoked_at) WHERE revoked_at IS NOT NULL;

-- Index for finding expired clients
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_expired ON openvpn_clients(expired_at);

-- Seed default OpenVPN client
