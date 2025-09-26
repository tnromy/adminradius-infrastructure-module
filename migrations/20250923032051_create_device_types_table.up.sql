-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS device_types (
	id          VARCHAR(36) PRIMARY KEY,
	name        VARCHAR(100) NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(name)
);

CREATE TRIGGER trg_device_types_updated
BEFORE UPDATE ON device_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

CREATE INDEX IF NOT EXISTS idx_device_types_lower_name ON device_types(LOWER(name));

-- Seed deterministic device types for ISP network topology
INSERT INTO device_types (id, name)
VALUES
	('00000000-0000-0000-0000-000000000401', 'Router'),
	('00000000-0000-0000-0000-000000000402', 'Switch'),
	('00000000-0000-0000-0000-000000000403', 'OLT'),
	('00000000-0000-0000-0000-000000000404', 'ODC'),
	('00000000-0000-0000-0000-000000000405', 'ODP'),
	('00000000-0000-0000-0000-000000000406', 'ONT')
ON CONFLICT (id) DO NOTHING;
