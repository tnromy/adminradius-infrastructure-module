-- Assumes set_updated_at_timestamp() already created in first migration

-- Reworked: normalized device_type into device_types table, added geo + location details
CREATE TABLE IF NOT EXISTS devices (
	id               VARCHAR(36) PRIMARY KEY,
	branch_id        VARCHAR(36) NOT NULL, -- reference to external system (no FK constraint)
	name             TEXT NOT NULL,
	device_type_id   VARCHAR(36) NOT NULL REFERENCES device_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
	latitude         DOUBLE PRECISION,      -- kept nullable; application may populate later
	longitude        DOUBLE PRECISION,      -- kept nullable; application may populate later
	location_details JSONB DEFAULT '{}'::jsonb NOT NULL, -- unstructured physical install info
	specifications   JSONB DEFAULT '{}'::jsonb NOT NULL,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(device_type_id, name) -- prevent duplicate names within same device type
);

-- Trigger for updated_at
CREATE TRIGGER trg_devices_updated
BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index on device_type for filtering
CREATE INDEX IF NOT EXISTS idx_devices_device_type_id ON devices(device_type_id);

-- Index for case-insensitive name searches
CREATE INDEX IF NOT EXISTS idx_devices_lower_name ON devices(LOWER(name));

-- GIN indexes for json lookups
CREATE INDEX IF NOT EXISTS idx_devices_specifications_gin ON devices USING GIN (specifications jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_devices_location_details_gin ON devices USING GIN (location_details jsonb_path_ops);

-- Optional composite index to speed up geo proximity queries (basic, not PostGIS)
CREATE INDEX IF NOT EXISTS idx_devices_lat_lon ON devices(latitude, longitude);
