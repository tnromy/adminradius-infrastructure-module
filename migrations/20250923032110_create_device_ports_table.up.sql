-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS device_ports (
	id                       VARCHAR(36) PRIMARY KEY,
	device_id                VARCHAR(36) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
	port_interface_id        VARCHAR(36) NOT NULL REFERENCES device_port_interfaces(id) ON DELETE RESTRICT,
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
CREATE INDEX IF NOT EXISTS idx_device_ports_port_interface_id ON device_ports(port_interface_id);
CREATE INDEX IF NOT EXISTS idx_device_ports_port_specification_id ON device_ports(port_specification_id);

-- Composite index for enumerating ports by device quickly with natural ordering
CREATE INDEX IF NOT EXISTS idx_device_ports_device_position ON device_ports(device_id, position);

-- Case-insensitive search of port name per device (supports partial matching; uses lower)
CREATE INDEX IF NOT EXISTS idx_device_ports_device_lower_name ON device_ports(device_id, LOWER(name));

-- GIN index for querying properties JSONB (path ops for structured key searches)
CREATE INDEX IF NOT EXISTS idx_device_ports_properties_gin ON device_ports USING GIN (properties jsonb_path_ops);

-- Seed deterministic device ports for the ISP topology
INSERT INTO device_ports (
	id,
	device_id,
	port_interface_id,
	port_specification_id,
	name,
	position,
	enabled,
	properties
)
VALUES
	(
		'00000000-0000-0000-0000-000000000601',
		'00000000-0000-0000-0000-000000000501',
		'00000000-0000-0000-0000-000000000302',
		'00000000-0000-0000-0000-000000000202',
		'sfpplus-1',
		1,
		TRUE,
		'{"speed_gbps":10,"medium":"fiber","role":"core-uplink"}'
	),
	(
		'00000000-0000-0000-0000-000000000602',
		'00000000-0000-0000-0000-000000000502',
		'00000000-0000-0000-0000-000000000302',
		'00000000-0000-0000-0000-000000000202',
		'uplink-sfpplus-1',
		1,
		TRUE,
		'{"speed_gbps":10,"medium":"fiber","role":"uplink-to-core"}'
	),
	(
		'00000000-0000-0000-0000-000000000603',
		'00000000-0000-0000-0000-000000000502',
		'00000000-0000-0000-0000-000000000302',
		'00000000-0000-0000-0000-000000000202',
		'downlink-sfpplus-1',
		2,
		TRUE,
		'{"speed_gbps":10,"medium":"fiber","role":"downlink-to-olt","vlan_trunk":true}'
	),
	(
		'00000000-0000-0000-0000-000000000604',
		'00000000-0000-0000-0000-000000000503',
		'00000000-0000-0000-0000-000000000302',
		'00000000-0000-0000-0000-000000000202',
		'uplink-sfpplus-1',
		1,
		TRUE,
		'{"speed_gbps":10,"medium":"fiber","role":"uplink-to-aggregation"}'
	),
	(
		'00000000-0000-0000-0000-000000000605',
		'00000000-0000-0000-0000-000000000503',
		'00000000-0000-0000-0000-000000000303',
		'00000000-0000-0000-0000-000000000203',
		'pon-1',
		2,
		TRUE,
		'{"split_ratio":"1:16","max_distance_km":20,"wavelength_nm":1490}'
	),
	(
		'00000000-0000-0000-0000-000000000606',
		'00000000-0000-0000-0000-000000000504',
		'00000000-0000-0000-0000-000000000303',
		'00000000-0000-0000-0000-000000000204',
		'feeder-sc-1',
		1,
		TRUE,
		'{"position":"feeder","capacity_fibers":24}'
	),
	(
		'00000000-0000-0000-0000-000000000607',
		'00000000-0000-0000-0000-000000000504',
		'00000000-0000-0000-0000-000000000303',
		'00000000-0000-0000-0000-000000000204',
		'distribution-sc-1',
		2,
		TRUE,
		'{"position":"distribution","split_ratio":"1:16"}'
	),
	(
		'00000000-0000-0000-0000-000000000608',
		'00000000-0000-0000-0000-000000000505',
		'00000000-0000-0000-0000-000000000303',
		'00000000-0000-0000-0000-000000000204',
		'input-sc-1',
		1,
		TRUE,
		'{"position":"input","core_color":"blue"}'
	),
	(
		'00000000-0000-0000-0000-000000000609',
		'00000000-0000-0000-0000-000000000505',
		'00000000-0000-0000-0000-000000000303',
		'00000000-0000-0000-0000-000000000204',
		'drop-sc-1',
		2,
		TRUE,
		'{"position":"drop","core_color":"white"}'
	),
	(
		'00000000-0000-0000-0000-000000000610',
		'00000000-0000-0000-0000-000000000506',
		'00000000-0000-0000-0000-000000000303',
		'00000000-0000-0000-0000-000000000203',
		'pon-in',
		1,
		TRUE,
		'{"role":"subscriber-uplink","signal_level_dbm":-19.5}'
	),
	(
		'00000000-0000-0000-0000-000000000611',
		'00000000-0000-0000-0000-000000000506',
		'00000000-0000-0000-0000-000000000301',
		'00000000-0000-0000-0000-000000000205',
		'lan1',
		2,
		TRUE,
		'{"speed_gbps":1,"poe_out":false,"vlan_profile":"HSI-100"}'
	)
ON CONFLICT (id) DO NOTHING;
