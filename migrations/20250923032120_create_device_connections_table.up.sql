-- Assumes set_updated_at_timestamp() already created in first migration

-- Optional helper function to canonicalize unordered connection pairs if you later want undirected uniqueness.
-- For now we enforce directed uniqueness (from_port_id,to_port_id). If you later need undirected, create a UNIQUE
-- index on (LEAST(from_port_id,to_port_id), GREATEST(from_port_id,to_port_id)). We'll include it commented.

CREATE TABLE IF NOT EXISTS device_connections (
	id              VARCHAR(36) PRIMARY KEY,
	from_port_id    VARCHAR(36) NOT NULL REFERENCES device_ports(id) ON DELETE CASCADE,
	to_port_id      VARCHAR(36) NOT NULL REFERENCES device_ports(id) ON DELETE CASCADE,
	details         JSONB DEFAULT '{}'::jsonb NOT NULL,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CHECK (from_port_id <> to_port_id),
	UNIQUE(from_port_id, to_port_id)
);

CREATE TRIGGER trg_device_connections_updated
BEFORE UPDATE ON device_connections
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Directed lookups
CREATE INDEX IF NOT EXISTS idx_device_connections_from_port ON device_connections(from_port_id);
CREATE INDEX IF NOT EXISTS idx_device_connections_to_port ON device_connections(to_port_id);

-- For querying either direction quickly, a covering index on sorted pair (useful if you implement undirected semantics)
CREATE INDEX IF NOT EXISTS idx_device_connections_pair ON device_connections(
	LEAST(from_port_id, to_port_id),
	GREATEST(from_port_id, to_port_id)
);

-- GIN index on details for structured queries (path ops)
CREATE INDEX IF NOT EXISTS idx_device_connections_details_gin ON device_connections USING GIN (details jsonb_path_ops);

-- Optionally prevent reciprocal duplicate if you consider undirected edges; leave commented for now.
-- CREATE UNIQUE INDEX idx_device_connections_undirected_unique ON device_connections (
--     LEAST(from_port_id, to_port_id),
--     GREATEST(from_port_id, to_port_id)
-- );

-- Seed deterministic physical connections across the simulated ISP network
INSERT INTO device_connections (id, from_port_id, to_port_id, details)
VALUES
	(
		'00000000-0000-0000-0000-000000000701',
		'00000000-0000-0000-0000-000000000601',
		'00000000-0000-0000-0000-000000000602',
		'{"medium":"fiber","description":"Metro core uplink from CCR2216 to CRS517","vlan_profile":"trunk-all"}'
	),
	(
		'00000000-0000-0000-0000-000000000702',
		'00000000-0000-0000-0000-000000000603',
		'00000000-0000-0000-0000-000000000604',
		'{"medium":"fiber","description":"Aggregation link from CRS517 to GPON OLT","wavelength_nm":1310}'
	),
	(
		'00000000-0000-0000-0000-000000000703',
		'00000000-0000-0000-0000-000000000605',
		'00000000-0000-0000-0000-000000000606',
		'{"medium":"fiber","description":"Feeder fiber from OLT PON port to ODC splitter","split_ratio":"1:16"}'
	),
	(
		'00000000-0000-0000-0000-000000000704',
		'00000000-0000-0000-0000-000000000607',
		'00000000-0000-0000-0000-000000000608',
		'{"medium":"fiber","description":"Distribution fiber from ODC to neighborhood ODP"}'
	),
	(
		'00000000-0000-0000-0000-000000000705',
		'00000000-0000-0000-0000-000000000609',
		'00000000-0000-0000-0000-000000000610',
		'{"medium":"fiber","description":"Drop fiber from ODP to subscriber ONT","subscriber_plan":"100 Mbps"}'
	)
ON CONFLICT (id) DO NOTHING;
