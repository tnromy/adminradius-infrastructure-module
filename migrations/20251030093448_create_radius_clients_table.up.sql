-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS radius_clients (
	id           VARCHAR(36) PRIMARY KEY,
	nas_id       INTEGER DEFAULT NULL,
	ip_address   VARCHAR(45) NOT NULL,
	name         VARCHAR(255) NOT NULL,
	secret       VARCHAR(36) DEFAULT NULL,
	description  TEXT DEFAULT NULL,
	is_use       BOOLEAN NOT NULL DEFAULT FALSE,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(ip_address),
	UNIQUE(name)
);

-- Trigger for updated_at
CREATE TRIGGER trg_radius_clients_updated
BEFORE UPDATE ON radius_clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index for case-insensitive name searches
CREATE INDEX IF NOT EXISTS idx_radius_clients_lower_name ON radius_clients(LOWER(name));

-- Index on IP address for lookups
CREATE INDEX IF NOT EXISTS idx_radius_clients_ip_address ON radius_clients(ip_address);

-- Index for filtering by is_use status
CREATE INDEX IF NOT EXISTS idx_radius_clients_is_use ON radius_clients(is_use);

-- Index on nas_id for lookups
CREATE INDEX IF NOT EXISTS idx_radius_clients_nas_id ON radius_clients(nas_id) WHERE nas_id IS NOT NULL;
