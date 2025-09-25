-- Simpler: just (re)create the helper trigger function. Using CREATE OR REPLACE is idempotent
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS device_port_specifications (
	id              VARCHAR(36) PRIMARY KEY,
	name            VARCHAR(255) NOT NULL,
	data            JSONB DEFAULT '{}'::jsonb NOT NULL,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(name)
);

-- Trigger to auto update updated_at on modification
CREATE TRIGGER trg_device_port_specifications_updated
BEFORE UPDATE ON device_port_specifications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- Index for JSONB containment/keys lookups (optional, broad GIN)
CREATE INDEX IF NOT EXISTS idx_device_port_specifications_data_gin
	ON device_port_specifications USING GIN (data jsonb_path_ops);

-- Helpful index on name for case-insensitive searches (optional)
CREATE INDEX IF NOT EXISTS idx_device_port_specifications_lower_name
	ON device_port_specifications (LOWER(name));
