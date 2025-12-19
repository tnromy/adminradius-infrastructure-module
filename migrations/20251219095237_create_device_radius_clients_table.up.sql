-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS device_radius_clients (
	id                      VARCHAR(36) PRIMARY KEY,
	device_openvpn_client_id VARCHAR(36) NOT NULL REFERENCES device_openvpn_clients(id) ON UPDATE CASCADE ON DELETE CASCADE,
	radius_client_id        INTEGER NOT NULL,
	encrypted_secret        TEXT NOT NULL,
	created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(device_openvpn_client_id),
	UNIQUE(radius_client_id)
);

-- Trigger for updated_at
CREATE TRIGGER trg_device_radius_clients_updated
BEFORE UPDATE ON device_radius_clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index on device_openvpn_client_id for lookups
CREATE INDEX IF NOT EXISTS idx_device_radius_clients_device_openvpn_client_id ON device_radius_clients(device_openvpn_client_id);

-- Index on radius_client_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_device_radius_clients_radius_client_id ON device_radius_clients(radius_client_id);
