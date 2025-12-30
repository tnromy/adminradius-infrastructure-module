-- Create device_firmwares table
CREATE TABLE IF NOT EXISTS device_firmwares (
    id          VARCHAR(36) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    version     VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_device_firmwares_updated
BEFORE UPDATE ON device_firmwares
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_firmwares_name ON device_firmwares(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_device_firmwares_version ON device_firmwares(version);

-- Create unique constraint on name + version
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_firmwares_name_version ON device_firmwares(name, version);

