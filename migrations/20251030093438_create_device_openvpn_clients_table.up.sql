-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS device_openvpn_clients (
	id                  VARCHAR(36) PRIMARY KEY,
	device_id           VARCHAR(36) NOT NULL REFERENCES devices(id) ON UPDATE CASCADE ON DELETE CASCADE,
	openvpn_client_id   VARCHAR(36) NOT NULL REFERENCES openvpn_clients(id) ON UPDATE CASCADE ON DELETE CASCADE,
	created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(device_id),
	UNIQUE(openvpn_client_id)
);

-- Trigger for updated_at
CREATE TRIGGER trg_device_openvpn_clients_updated
BEFORE UPDATE ON device_openvpn_clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index on device_id for lookups
CREATE INDEX IF NOT EXISTS idx_device_openvpn_clients_device_id ON device_openvpn_clients(device_id);

-- Index on openvpn_client_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_device_openvpn_clients_openvpn_client_id ON device_openvpn_clients(openvpn_client_id);
