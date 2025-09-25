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
