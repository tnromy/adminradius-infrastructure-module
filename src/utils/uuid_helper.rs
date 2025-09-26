use uuid7::uuid7;

pub fn generate() -> String {
    uuid7().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_uuid() {
        let uuid = generate();
        assert_eq!(uuid.len(), 36); // UUID length should be 36 characters
        assert!(uuid.chars().all(|c| c.is_ascii_hexdigit() || c == '-')); // Should only contain hex digits and hyphens

        // Generate two UUIDs and ensure they're different
        let uuid1 = generate();
        let uuid2 = generate();
        assert_ne!(uuid1, uuid2);
    }
}
