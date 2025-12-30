-- Create device_firmware_scripts table
CREATE TABLE IF NOT EXISTS device_firmware_scripts (
    id                   VARCHAR(36) PRIMARY KEY,
    device_firmware_id   VARCHAR(36) NOT NULL REFERENCES device_firmwares(id) ON DELETE CASCADE,
    name                 VARCHAR(255) NOT NULL,
    description          TEXT,
    script_text          TEXT NOT NULL,
    script_params        JSONB DEFAULT '[]'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_device_firmware_scripts_updated
BEFORE UPDATE ON device_firmware_scripts
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_firmware_scripts_device_firmware_id ON device_firmware_scripts(device_firmware_id);
CREATE INDEX IF NOT EXISTS idx_device_firmware_scripts_name ON device_firmware_scripts(LOWER(name));

-- Create unique constraint on device_firmware_id + name
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_firmware_scripts_firmware_name ON device_firmware_scripts(device_firmware_id, name);

