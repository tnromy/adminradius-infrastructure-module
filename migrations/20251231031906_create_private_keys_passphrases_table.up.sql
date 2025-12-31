-- Create private_keys_passphrases table for storing encrypted passphrases per private key

CREATE TABLE IF NOT EXISTS private_keys_passphrases (
	id                    VARCHAR(36) PRIMARY KEY,
	private_key_hash      TEXT NOT NULL,
	encrypted_passphrase  TEXT NOT NULL,
	UNIQUE(private_key_hash)
);

-- Index on private_key_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_private_keys_passphrases_hash ON private_keys_passphrases(private_key_hash);
