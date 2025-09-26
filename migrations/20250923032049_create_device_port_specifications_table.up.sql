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

-- Seed deterministic device port specifications for ISP network modeling
INSERT INTO device_port_specifications (id, name, data)
VALUES
	(
		'00000000-0000-0000-0000-000000000201',
		'Gigabit Ethernet RJ45',
		'{"speed_gbps":1,"connector":"RJ45","medium":"Copper","standard":"IEEE 802.3ab"}'
	),
	(
		'00000000-0000-0000-0000-000000000202',
		'10 Gigabit SFP+ Optics',
		'{"speed_gbps":10,"connector":"SFP+","medium":"Single-mode fiber","wavelength_nm":1310,"supported_standards":["10GBASE-LR","10GBASE-LW"]}'
	),
	(
		'00000000-0000-0000-0000-000000000203',
		'GPON SC/APC Subscriber Interface',
		'{"speed_down_mbps":2488,"speed_up_mbps":1244,"connector":"SC/APC","medium":"Single-mode fiber","standard":"ITU-T G.984"}'
	),
	(
		'00000000-0000-0000-0000-000000000204',
		'Passive PLC Splitter Port',
		'{"split_ratio":"1:16","insertion_loss_db":14.7,"connector":"SC/APC","enclosure_rating":"IP55"}'
	),
	(
		'00000000-0000-0000-0000-000000000205',
		'ONT Gigabit LAN RJ45',
		'{"speed_gbps":1,"connector":"RJ45","medium":"Copper","supports_poe":false}'
	)
ON CONFLICT (id) DO NOTHING;
