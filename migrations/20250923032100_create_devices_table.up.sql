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

-- Seed deterministic ISP device inventory
INSERT INTO devices (
	id,
	branch_id,
	name,
	device_type_id,
	latitude,
	longitude,
	location_details,
	specifications
)
VALUES
	(
		'00000000-0000-0000-0000-000000000501',
		'10000000-0000-0000-0000-000000000001',
		'Jakarta Core Router CCR2216',
		'00000000-0000-0000-0000-000000000401',
		-6.1731,
		106.8267,
		'{"site_name":"Jakarta Core POP","address":"Jl. Medan Merdeka Barat 12, Jakarta","rack":"Row A Rack 3","elevation_m":35}',
		'{"vendor":"MikroTik","model":"CCR2216-1G-12XS-2XQ","os":{"name":"RouterOS","version":"7.15"},"cpu":{"architecture":"ARM64","cores":16,"clock_mhz":2000},"memory_mb":16384,"storage_gb":128,"interfaces":{"sfp_plus":12,"qsfp28":2},"redundant_power":true,"license_level":7}'
	),
	(
		'00000000-0000-0000-0000-000000000502',
		'10000000-0000-0000-0000-000000000001',
		'Jakarta Aggregation Switch CRS517',
		'00000000-0000-0000-0000-000000000402',
		-6.1732,
		106.8269,
		'{"site_name":"Jakarta Core POP","rack":"Row B Rack 1","power_feed":"A+B"}',
		'{"vendor":"MikroTik","model":"CRS517-1GI-4XS-2XQ","os":{"name":"RouterOS","version":"7.15"},"switching_capacity_gbps":320,"interfaces":{"sfp_plus":17,"qsfp28":2},"backplane_bandwidth_gbps":640,"cooling":"Front-to-back"}'
	),
	(
		'00000000-0000-0000-0000-000000000503',
		'10000000-0000-0000-0000-000000000001',
		'Central GPON OLT AN5516',
		'00000000-0000-0000-0000-000000000403',
		-6.1733,
		106.8271,
		'{"site_name":"Jakarta Core POP","rack":"Row C Rack 2","frame":"AN5516-04"}',
		'{"vendor":"FiberHome","model":"AN5516-04","os":{"name":"NMS","version":"R18"},"pon_slots":4,"uplink_slots":2,"max_subscribers":4096,"power_dual":true}'
	),
	(
		'00000000-0000-0000-0000-000000000504',
		'10000000-0000-0000-0000-000000000002',
		'ODC - Kebayoran Baru Cabinet',
		'00000000-0000-0000-0000-000000000404',
		-6.2004,
		106.8456,
		'{"site_name":"Jl. Wijaya II Cabinet","enclosure":"Outdoor IP65","pole_number":"KB-ODC-07"}',
		'{"vendor":"PT Telkom Infra","model":"FDC-288F","fibers_supported":288,"splitter_capacity":18,"operating_temp_c":[-40,60]}'
	),
	(
		'00000000-0000-0000-0000-000000000505',
		'10000000-0000-0000-0000-000000000002',
		'ODP - Taman Patal Senayan',
		'00000000-0000-0000-0000-000000000405',
		-6.2221,
		106.8479,
		'{"site_name":"Cluster Taman Patal","mounting":"Pole","pole_number":"ODP-PS-12"}',
		'{"vendor":"Huawei","model":"FDB-16A","ports":16,"supports_poe":false,"weatherproof":true}'
	),
	(
		'00000000-0000-0000-0000-000000000506',
		'10000000-0000-0000-0000-000000000002',
		'Customer ONT EchoLife HG8245H5',
		'00000000-0000-0000-0000-000000000406',
		-6.2230,
		106.8485,
		'{"site_name":"Rumah Sejahtera Residence","contact_person":"Adi Prasetyo","floor":"2"}',
		'{"vendor":"Huawei","model":"EchoLife HG8245H5","os":{"name":"V3R017C10"},"pon_standard":"GPON","wifi":{"standards":["802.11ac","802.11n"],"max_clients":64},"lan_ports":4,"voice_ports":2,"power_backup_minutes":30}'
	)
ON CONFLICT (id) DO NOTHING;
