DROP TABLE IF EXISTS device_port_specifications;
-- Drop helper trigger function (still safe if other tables also recreated it later)
DROP FUNCTION IF EXISTS set_updated_at_timestamp();
