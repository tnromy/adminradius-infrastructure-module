-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS device_ports (
	id                       VARCHAR(36) PRIMARY KEY,
	device_id                VARCHAR(36) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
	port_type_id             VARCHAR(36) NOT NULL REFERENCES device_port_interfaces(id) ON DELETE RESTRICT,
	port_specification_id    VARCHAR(36) REFERENCES device_port_specifications(id) ON DELETE SET NULL,
	name                     VARCHAR(100) NOT NULL,
	position                 INTEGER, -- optional ordering on device (nullable)
	enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
	properties               JSONB DEFAULT '{}'::jsonb NOT NULL, -- additional per-port attributes
	created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(device_id, name)
);

CREATE TRIGGER trg_device_ports_updated
BEFORE UPDATE ON device_ports
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Indexes aiding lookups / joins
CREATE INDEX IF NOT EXISTS idx_device_ports_device_id ON device_ports(device_id);
CREATE INDEX IF NOT EXISTS idx_device_ports_port_type_id ON device_ports(port_type_id);
CREATE INDEX IF NOT EXISTS idx_device_ports_port_specification_id ON device_ports(port_specification_id);

-- Composite index for enumerating ports by device quickly with natural ordering
CREATE INDEX IF NOT EXISTS idx_device_ports_device_position ON device_ports(device_id, position);

-- Case-insensitive search of port name per device (supports partial matching; uses lower)
CREATE INDEX IF NOT EXISTS idx_device_ports_device_lower_name ON device_ports(device_id, LOWER(name));

-- GIN index for querying properties JSONB (path ops for structured key searches)
CREATE INDEX IF NOT EXISTS idx_device_ports_properties_gin ON device_ports USING GIN (properties jsonb_path_ops);
