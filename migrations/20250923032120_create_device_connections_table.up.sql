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

