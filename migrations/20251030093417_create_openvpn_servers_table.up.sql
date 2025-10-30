-- Assumes set_updated_at_timestamp() already created in first migration

CREATE TABLE IF NOT EXISTS openvpn_servers (
	id                       VARCHAR(36) PRIMARY KEY,
	name                     VARCHAR(255) NOT NULL,
	host               VARCHAR(45) NOT NULL,
	port                     INTEGER NOT NULL DEFAULT 1194,
	proto                    VARCHAR(10) NOT NULL DEFAULT 'udp',
	cipher                   VARCHAR(50) DEFAULT 'AES-256-CBC',
	auth_algorithm           VARCHAR(50) NOT NULL DEFAULT 'SHA256',
	tls_key_pem              TEXT,
	tls_key_mode             VARCHAR(10) DEFAULT NULL,
	ca_chain_pem             TEXT NOT NULL,
	dh_pem                   TEXT NOT NULL,
	remote_cert_tls_name     VARCHAR(100) NOT NULL DEFAULT 'server',
	crl_distribution_point   TEXT,
	created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(name),
	UNIQUE(host, port)
);

-- Trigger for updated_at
CREATE TRIGGER trg_openvpn_servers_updated
BEFORE UPDATE ON openvpn_servers
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Index for case-insensitive name searches
CREATE INDEX IF NOT EXISTS idx_openvpn_servers_lower_name ON openvpn_servers(LOWER(name));

-- Index for IP address lookups
CREATE INDEX IF NOT EXISTS idx_openvpn_servers_host ON openvpn_servers(host);

-- Seed default OpenVPN server
INSERT INTO openvpn_servers (
	id,
	name,
	host,
	port,
	proto,
	cipher,
	auth_algorithm,
	tls_key_pem,
	tls_key_mode,
	ca_chain_pem,
	dh_pem,
	remote_cert_tls_name,
	crl_distribution_point
)
VALUES (
	'019a34a2-cb9e-78ad-a4be-b2e83a1ff440',
	'server.racenet.openvpn.adminradius.com',
	'192.168.23.2',
	1194,
	'tcp',
	'AES-256-CBC',
	'SHA1',
	NULL,
	NULL,
	E'Bag Attributes: <No Attributes>\nsubject=C=ID, ST=Banten, L=Tangerang Selatan, O=PT. Rezeki Asa Cemerlang, OU=Racenet AdminRadius, CN=CA Intermediate for Racenet AdminRadius OpenVPN\nissuer=C=ID, ST=Jakarta, L=Jakarta Selatan, O=Certificate Identity Indonesia, OU=Certy.id Online Certificate Authority, CN=Certy.id Root CA, emailAddress=support@certy.id\n-----BEGIN CERTIFICATE-----\nMIIG8jCCBNqgAwIBAgICA+owDQYJKoZIhvcNAQELBQAwgc4xCzAJBgNVBAYTAklE\nMRAwDgYDVQQIDAdKYWthcnRhMRgwFgYDVQQHDA9KYWthcnRhIFNlbGF0YW4xJzAl\nBgNVBAoMHkNlcnRpZmljYXRlIElkZW50aXR5IEluZG9uZXNpYTEuMCwGA1UECwwl\nQ2VydHkuaWQgT25saW5lIENlcnRpZmljYXRlIEF1dGhvcml0eTEZMBcGA1UEAwwQ\nQ2VydHkuaWQgUm9vdCBDQTEfMB0GCSqGSIb3DQEJARYQc3VwcG9ydEBjZXJ0eS5p\nZDAeFw0yNTEwMjkwNzQ4MDRaFw0zMDEwMjgwNzQ4MDRaMIG1MQswCQYDVQQGEwJJ\nRDEPMA0GA1UECAwGQmFudGVuMRowGAYDVQQHDBFUYW5nZXJhbmcgU2VsYXRhbjEh\nMB8GA1UECgwYUFQuIFJlemVraSBBc2EgQ2VtZXJsYW5nMRwwGgYDVQQLDBNSYWNl\nbmV0IEFkbWluUmFkaXVzMTgwNgYDVQQDDC9DQSBJbnRlcm1lZGlhdGUgZm9yIFJh\nY2VuZXQgQWRtaW5SYWRpdXMgT3BlblZQTjCCAiIwDQYJKoZIhvcNAQEBBQADggIP\nADCCAgoCggIBAO5pS56VHcg8OMmvbWDZxFKE/o7kiqH5IUq4MSgRdF1bT3Co15VU\nAA+PZMhkrGcGezpSdbUCuClUXnBiD1fhFVampG3FZMqdhUixSrLVO1bZh9rlEUbl\ndjmMcwKwcgws2YTIFBn/n3S0J4hu2N0FoB06UYRpNOlL52E4WJNPrBn64ZSrACSB\nKBeWjseuT1t+B5k7UsC4xyzdvhmaX27/zHtCoIwg8VWuPRNA9mPN77qpq+STehMr\nb68NtzgRUWDgXyv29SQKBqFXODCR+EuaPuHjMw5YhTvM7jT0F+2LOKDMTJyPnlrc\nEIWekRc1hF8ghCEN/nMyI1kVHkIYE6Vb91FUY4gw8DIXGMkRcnY5mw6SRDzpeub4\n98kX/SY/wR86elOdFGaLooSKRy5QMSbPIHBqPDOx/yFN8z7ssSyBdCRJ10i0BsPl\nEIt/aVAYzUYg6cIBV2wmqHytMTqcKQLac5szwrMdBCwgYC8FE1JDXuftEngiJGke\nkC/tniM7EMU2dNCvwi5jjZZqEzYUo3/ADGtJOojsJ4sJsTvbm9pbt3tSks0GjjsT\nX+EYeHh/MN3c0jqRT3zQcFKoLZe5HUP6CFJ8B0dayI4egfmBIe6Cc2zMc4pEQip9\ncq/MTcjOmZijV0YWCSD3iir31mU1IGg23KyMKAanYju/Uz6rU63/FyE/AgMBAAGj\ngfAwge0wHQYDVR0OBBYEFHXOgf6jjBvojB0/zPe1Y4nxnHcYMB8GA1UdIwQYMBaA\nFO4YCfb+cBQaCRqZu3LB06TecfPXMFoGCCsGAQUFBwEBBE4wTDAlBggrBgEFBQcw\nAoYZaHR0cDovL2NhLmNlcnR5LmlkL2NhLmRlcjAjBggrBgEFBQcwAYYXaHR0cDov\nL2NhLmNlcnR5LmlkL29jc3AwKwYDVR0fBCQwIjAgoB6gHIYaaHR0cDovL2NhLmNl\ncnR5LmlkL2NybC5kZXIwEgYDVR0TAQH/BAgwBgEB/wIBADAOBgNVHQ8BAf8EBAMC\nAQYwDQYJKoZIhvcNAQELBQADggIBAEEaCKijcSlZ1YwJiNDbvi6dO5blIcMqqucc\n5lBlgpp/FBMafGXpgtlW+UWqHKrv3M8Ga/btA8GH1I9AejVGumsSMShxlU3kGJzw\nnnx/kPkka350UNJMWa9DfhtezpgSWnkoPWvTK0KinNjGhHoX9Xx2BCnyQDBA+tjA\ngqBJnsxOs1INLhYcGFE6ibrSxh+tMFZqDXHwP2jqyyxEyiAUYbfEmv7QhKbqm+j+\nVvBl7y5oihwH0zUEJe+TgRqYDxupS0lO9/vc4HPo8LS33UZ8JfZnpUvN44HiGArM\nkDJFu5vJX6smAafQ31fPIOrS/9OcmzPWIfGAp9bDzH66MFidAr92SW//FkmyFzbB\np9s3imCGgKW3XNH8b/MyZ2gW9OZCqwwGwQ977slDePutTadNoK55tLd7KJwvqqVN\nFGibEQBTnvcKgGU/tBF/FUq13F2D5w25gelYRaJ9k1xY755RFaPhjl6+vhgJnIoB\n1yZzMwPTS7e67NwozDE+d5QfoWTPWd/kc9WMw+yLLjYB3pDcPb486ZHX1SOiJpPd\nghD68QlWW/DGdCDVJTZTHpK/+zYa2xPh/MKoshvmyHn1iKIsMpvSWVkouu4TSPIw\nqg0Ag9Fo2DD5JfxrdwxDhOn5JBqNZRmb0CytaHCMKALqAW2+jyaJ4IftLBw2mtsI\nAxBM7EBO\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIGkjCCBHqgAwIBAgIUWJ0iNlBoJ4oLgEdjF2NZ2QlYlzUwDQYJKoZIhvcNAQEL\nBQAwgc4xCzAJBgNVBAYTAklEMRAwDgYDVQQIDAdKYWthcnRhMRgwFgYDVQQHDA9K\nYWthcnRhIFNlbGF0YW4xJzAlBgNVBAoMHkNlcnRpZmljYXRlIElkZW50aXR5IElu\nZG9uZXNpYTEuMCwGA1UECwwlQ2VydHkuaWQgT25saW5lIENlcnRpZmljYXRlIEF1\ndGhvcml0eTEZMBcGA1UEAwwQQ2VydHkuaWQgUm9vdCBDQTEfMB0GCSqGSIb3DQEJ\nARYQc3VwcG9ydEBjZXJ0eS5pZDAeFw0yNTEwMjkwNjIzNTFaFw00NTEwMjQwNjIz\nNTFaMIHOMQswCQYDVQQGEwJJRDEQMA4GA1UECAwHSmFrYXJ0YTEYMBYGA1UEBwwP\nSmFrYXJ0YSBTZWxhdGFuMScwJQYDVQQKDB5DZXJ0aWZpY2F0ZSBJZGVudGl0eSBJ\nbmRvbmVzaWExLjAsBgNVBAsMJUNlcnR5LmlkIE9ubGluZSBDZXJ0aWZpY2F0ZSBB\ndXRob3JpdHkxGTAXBgNVBAMMEENlcnR5LmlkIFJvb3QgQ0ExHzAdBgkqhkiG9w0B\nCQEWEHN1cHBvcnRAY2VydHkuaWQwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK\nAoICAQCRxc51MlhQeZ2gVrCLilQxXb17mCzM7B9wxrhM9Vt/cW4UG6JCiNZ0NDWI\nK/0rwLEpmihYtKO8C4UgoBji4gdJQmAmQ+lKpvo+tav9ftVDpezC9jkMYz098uPR\nhb6CJv3flmuzIIDvBC1CVj8/g3WTCGPeOwEDAmIALBR555XhMrf/rBTNdeFdfFTw\nQnHINOBZJMb1GcWy87koiQmtW1QGLMJIH4ue8ll1XVUUHT3dO0uuiTgel4CYxTIT\nVtziBlV5r0a9WPZUnU2lydSNbpFDr4lLR+YBgx6H23igI9l1V+3fcJadrvqF+yvh\n2zJku55VZlL9vEnF3KJHznKuFLHGji9jRf15FEkzjFtMuS1nzHw8Dxcn16WMPxLP\n6z6jgEzhDmFKJcoQ0RiqcvMhsSJS8PQ4NgfyZAQleKyk8yMkcbix5tCtQ6bL9tRX\nISa+WhQnvkQ0xwIOhY1GgJl5aatCuOvXnt1Bif1p37d7QFFOXadK+7kfnuh+IFcN\nlEXlCGzzEL67TJmTdoJ8US91zr86U7LcReVCpmmZ8i3J4SKlVGShqiTeVufks/tI\ntD51oz/eLrI8CFekXT1AaXvSgWjle3yuWl6uFoxXPr+9bpNq6MXKNVzSss0DiZqZ\nu6ENdKwHAGHJI6QVXwQ58m0fZircCupUfG9WXDl8mHHGMy3XRQIDAQABo2YwZDAd\nBgNVHQ4EFgQU7hgJ9v5wFBoJGpm7csHTpN5x89cwHwYDVR0jBBgwFoAU7hgJ9v5w\nFBoJGpm7csHTpN5x89cwEgYDVR0TAQH/BAgwBgEB/wIBATAOBgNVHQ8BAf8EBAMC\nAQYwDQYJKoZIhvcNAQELBQADggIBABLX0D8yBb1rw3p0N2gda2plqLC6wIuNiRNy\nHnb1+48LY2aW9LsPrvFyJyLbVxRkdxKIAWmOirT2T297p3ee+bG3SEMTIHC+W76L\ns1JTH0DzEZkou7hHEa/eg4lxZ/NsPd/3zkyd9nNJxiLeevtKwVcn7hHnwXmyliG9\ndyAqw8TfmD0H4xRnJZg/bOXmGkwv+OcQBq5w1085/ZvIBTuz9zAzJe08sG6ewJ4l\ngv5VBkvVYAs3j76NagJCkNGeEd5gER2U/lygaPUQsSjxK7f4dPEaBSYoPJbuGIOk\n5fKDsp4x2/tZEw9mBoA7J56SqYGFBdt+XUk9shw2I1CK1l1I19HZDxqkSdSJnDMU\nrpkF+3aOwS2mpdIhfpJSI98G6G7RNsSIGfZI8JFlzOJ7ZtcC1pGWVfdsMPs6ho3o\ntOimJ8DoG9OIpCNKQTbjHl1TC4fva7s77eqi8bgja7qNhOl4PI0bSjsJQQCKWgMv\nA48ziOzEppOezLbXgjXAJBmvwbxJnP4L9u5v1pNZPm1kw3351aS94vKb3tGoLQd2\n6CP1nkWbrRPqrcYsmjH18XzBdfJwxu88itlZt1sIHebX9FMQqguJ6KjZievWN2Qy\no4yeCi0ZxgUvu5o89KaZoc4KYrGpriUbE6AwfchikPYBEZiSysQwBXZAX/wlRYb4\nfg4pM0zX\n-----END CERTIFICATE-----\n',
	E'-----BEGIN DH PARAMETERS-----\nMIIBCAKCAQEA//////////+t+FRYortKmq/cViAnPTzx2LnFg84tNpWp4TZBFGQz\n+8yTnc4kmz75fS/jY2MMddj2gbICrsRhetPfHtXV/WVhJDP1H18GbtCFY2VVPe0a\n87VXE15/V8k1mE8McODmi3fipona8+/och3xWKE2rec1MKzKT0g6eXq8CrGCsyT7\nYdEIqUuyyOP7uWrat2DX9GgdT0Kj3jlN9K5W7edjcrsZCwenyO4KbXCeAvzhzffi\n7MA0BM0oNC9hkXL+nOmFg/+OTxIy7vKBg8P+OxtMb61zO7X8vC7CIAXFjvGDfRaD\nssbzSibBsu/6iGtCOGEoXJf//////////wIBAg==\n-----END DH PARAMETERS-----\n',
	'server',
	'http://ca.certy.id/racenet-openvpn/crl.pem'
);
