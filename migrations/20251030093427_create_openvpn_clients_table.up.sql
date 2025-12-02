-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS openvpn_clients (
	id                   VARCHAR(36) PRIMARY KEY,
	server_id            VARCHAR(36) NOT NULL REFERENCES openvpn_servers(id) ON UPDATE CASCADE ON DELETE CASCADE,
	cn                   VARCHAR(64) NOT NULL,
	reserved_ip_address  VARCHAR(45),
	certificate_pem      TEXT NOT NULL,
	encrypted_private_key_pem      TEXT NOT NULL,
	revoked_at           TIMESTAMPTZ DEFAULT NULL,
	expired_at           TIMESTAMPTZ NOT NULL,
	created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(server_id, cn)
);

-- Trigger for updated_at
CREATE TRIGGER trg_openvpn_clients_updated
BEFORE UPDATE ON openvpn_clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index on server_id for filtering clients by server
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_server_id ON openvpn_clients(server_id);

-- Index on cn for lookups
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_cn ON openvpn_clients(cn);

-- Index for reserved IP address lookups
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_reserved_ip ON openvpn_clients(reserved_ip_address) WHERE reserved_ip_address IS NOT NULL;

-- Index for finding revoked clients
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_revoked ON openvpn_clients(revoked_at) WHERE revoked_at IS NOT NULL;

-- Index for finding expired clients
CREATE INDEX IF NOT EXISTS idx_openvpn_clients_expired ON openvpn_clients(expired_at);

-- Seed default OpenVPN client
INSERT INTO openvpn_clients (
	id,
	server_id,
	cn,
	reserved_ip_address,
	certificate_pem,
	private_key_pem,
	revoked_at,
	expired_at
)
VALUES (
	'fc0a8afa-b57b-11f0-8de9-0242ac120002',
	'019a34a2-cb9e-78ad-a4be-b2e83a1ff440',
	'admin',
	'10.8.9.2',
	E'Bag Attributes\n    friendlyName: identity\n    localKeyID: E8 AD E0 39 3F DB 3F E7 B8 8B E0 C3 7E 5A 0D E0 94 F5 8C 1E \nsubject=CN=admin\nissuer=C=ID, ST=Banten, L=Tangerang Selatan, O=PT. Rezeki Asa Cemerlang, OU=Racenet AdminRadius, CN=CA Intermediate for Racenet AdminRadius OpenVPN\n-----BEGIN CERTIFICATE-----\nMIIGbzCCBFcCAgPqMA0GCSqGSIb3DQEBCwUAMIG1MQswCQYDVQQGEwJJRDEPMA0G\nA1UECAwGQmFudGVuMRowGAYDVQQHDBFUYW5nZXJhbmcgU2VsYXRhbjEhMB8GA1UE\nCgwYUFQuIFJlemVraSBBc2EgQ2VtZXJsYW5nMRwwGgYDVQQLDBNSYWNlbmV0IEFk\nbWluUmFkaXVzMTgwNgYDVQQDDC9DQSBJbnRlcm1lZGlhdGUgZm9yIFJhY2VuZXQg\nQWRtaW5SYWRpdXMgT3BlblZQTjAeFw0yNTEwMzAxMTE0MTdaFw0yODEwMjkxMTE0\nMTdaMBAxDjAMBgNVBAMMBWFkbWluMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIIC\nCgKCAgEA5CWDZueYPPzElXiMSWepPbU7+uGP5RzbudzsILnVYIMeGLO9PGta2UHQ\nEex1M6d3V5Q32ttEwldyu2OhHVMJG2/RTt1hAZBScGVzVy0Rl+byIp3hBp9hDztc\nB4XKh41V5kNhfeA5s4DIikVzsE+ubs1E4SaGZOwuKlXRg6PIgOe6K44GheNPol5u\nt24Uz8yEsbHatIBj1xZmjS00K9q++tiGvzbxD0p9RdaQ0twwyogMnPbZLcuj6vrT\nPyEXO/51EUss5ebjAHh8hEgE8zM32U+uBYbWdBmOqSeYljGIYy+8Qmk5ZOOL5q4P\nlAX2md2pCYm57R2R8Vk7rDX5THht5UdXnATbnFy9H/XYHNDAZ11jX70K54kZCuD2\nI3bG31ANCp5jigSIxZCV6sdEks2EdXR+zEXpzCtSowrtbeC2eB3cb42wQvr+2MCf\nto/k/FV1iMXHYw6sCfxVElDRwhQrDSwPhRn+6WMqW1sz95GdnGSGJzHSVA6XjMUF\nGNsYxYGt74VTOWafnjVMeaJemfSTUKqIYEv8zvDhmYorbvnyMo2cFIyEB+d3BqUe\nVDneYcqhrMs2Of4ZsDYolUKVwsZESKDZnthONPUH2hocHH/R1br0NZ5RV8B+JZDM\nB0+JZhqiIOzsj8XEA/ULq9kzyeykmvx+8ALFwf773pdy1FODo88CAwEAAaOCATAw\nggEsMB0GA1UdDgQWBBSw7l+WEWX0jGP5SrkoYvV/P+acAjAfBgNVHSMEGDAWgBR1\nzoH+o4wb6IwdP8z3tWOJ8Zx3GDB6BggrBgEFBQcBAQRuMGwwNQYIKwYBBQUHMAKG\nKWh0dHA6Ly9jYS5jZXJ0eS5pZC9yYWNlbmV0LW9wZW52cG4vY2EuZGVyMDMGCCsG\nAQUFBzABhidodHRwOi8vY2EuY2VydHkuaWQvcmFjZW5ldC1vcGVudnBuL29jc3Aw\nOwYDVR0fBDQwMjAwoC6gLIYqaHR0cDovL2NhLmNlcnR5LmlkL3JhY2VuZXQtb3Bl\nbnZwbi9jcmwuZGVyMAkGA1UdEwQCMAAwDgYDVR0PAQH/BAQDAgeAMBYGA1UdJQEB\n/wQMMAoGCCsGAQUFBwMCMA0GCSqGSIb3DQEBCwUAA4ICAQA0O0GTobjaKRXPkyGW\nW2u0z6Xo4dHoBzb8ozv6LmqzlnbFzCrl8eVW0xMowuUP95sJllh5abcgXyLVpKHA\nKR9Nf1TNrrenkvL++PxGIw4t0v81mFJ7hPirP72bhotx1pXFmRpKJk/M2kC2V1QL\nU2WAgdt1L8EN6lfADvKI6Gdd21ondYl5Lh9NQqr7zeo6vYK4ObNEaOPHYlmOL2vO\nk6S6GnMq12zGGniqlZuvP4+TGu5ifoirxkQb2v7MUeFHfKxMv8AyuKK4vu6ckK9T\nRuoY14xb5wnQl91EThDtYo2zgML2CJFZkWKqV7ay49W0ws/ot/0NQ775HxN74zbx\n564hRwlpqMWdY90jwlwmddmPhBXfJDpLUgbWnliULDP1SYe6S/FoYfXibS0k0913\nzT6qlEvj/cjJ7WQSUuZUdkfyWkZS/ho6kVKXfHkbFp6BETix9T9VH++S/q7VIGNV\nYYV0Tgt8c/hzUurTfzA7m2uuO8nbuOsjD5LUkkiY1PlmBld19fAOxW1exs7l7/xU\nslJntWiFB+xHxro6T7l7dp6IDM43xqm8vlropOe/1Vh/xQwxvIFyZWubiZJyn/TS\ndwhW0tW8d1ebrGiEkQ3q5UBJUEjP0wQWS1RGDMmax7wAMghbS+tZlgxIrzgJuSn8\n3RqyxqoQYfLBS0nDgbSiU4JZIA==\n-----END CERTIFICATE-----\n',
	E'Bag Attributes\n    friendlyName: identity\n    localKeyID: E8 AD E0 39 3F DB 3F E7 B8 8B E0 C3 7E 5A 0D E0 94 F5 8C 1E \nKey Attributes: <No Attributes>\n-----BEGIN PRIVATE KEY-----\n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\nWV8o20rrlmjyRaPTFkJ0ttuWEYlwSg==\n-----END PRIVATE KEY-----\n',
	NULL,
	NOW() + INTERVAL '1 year'
);
