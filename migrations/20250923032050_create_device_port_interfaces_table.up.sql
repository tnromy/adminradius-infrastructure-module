-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS device_port_interfaces (
	id          VARCHAR(36) PRIMARY KEY,
	name        VARCHAR(100) NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(name)
);

CREATE TRIGGER trg_device_port_interfaces_updated
BEFORE UPDATE ON device_port_interfaces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE INDEX IF NOT EXISTS idx_device_port_interfaces_lower_name
	ON device_port_interfaces (LOWER(name));

-- Seed deterministic device port interfaces used across the ISP topology
INSERT INTO device_port_interfaces (id, name)
VALUES
	('00000000-0000-0000-0000-000000000301', 'RJ45 Copper Ethernet'),
	('00000000-0000-0000-0000-000000000302', 'SFP+ 10G Optical'),
	('00000000-0000-0000-0000-000000000303', 'SC/APC Single-mode Fiber'),
	('00000000-0000-0000-0000-000000000304', 'LC Duplex Single-mode Fiber')
ON CONFLICT (id) DO NOTHING;
