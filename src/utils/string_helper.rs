/// String-related stateless helpers.
///
/// All functions here are pure: depend only on parameters and return values
/// without performing side effects.

/// Split a string by any ASCII/Unicode whitespace and return the non-empty parts.
///
/// Notes:
/// - Uses `split_whitespace`, so multiple spaces, tabs, and newlines are treated
///   as delimiters and empty segments are skipped.
pub fn string_space_to_list(input: &str) -> Vec<String> {
    input.split_whitespace().map(|s| s.to_string()).collect()
}

/// Compare two whitespace separated lists regardless of order.
/// Returns true when both contain exactly the same unique multiset of items (case-sensitive) and same counts.
pub fn string_space_match(a: &str, b: &str) -> bool {
    use std::collections::HashMap;
    let list_a = string_space_to_list(a);
    let list_b = string_space_to_list(b);
    if list_a.len() != list_b.len() {
        return false;
    }
    let mut map: HashMap<&str, i32> = HashMap::new();
    for item in &list_a {
        *map.entry(item.as_str()).or_insert(0) += 1;
    }
    for item in &list_b {
        match map.get_mut(item.as_str()) {
            Some(cnt) => {
                *cnt -= 1;
                if *cnt == 0 {
                    map.remove(item.as_str());
                }
            }
            None => return false,
        }
    }
    map.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_simple_spaces() {
        let out = string_space_to_list("a b c");
        assert_eq!(out, vec!["a", "b", "c"]);
    }

    #[test]
    fn trims_and_ignores_multiple_whitespace() {
        let out = string_space_to_list("  a   b\tc\nd  ");
        assert_eq!(out, vec!["a", "b", "c", "d"]);
    }

    #[test]
    fn single_word() {
        let out = string_space_to_list("hello");
        assert_eq!(out, vec!["hello"]);
    }

    #[test]
    fn empty_or_only_spaces() {
        assert!(string_space_to_list("").is_empty());
        assert!(string_space_to_list("    ").is_empty());
    }

    #[test]
    fn match_same_items_different_order() {
        assert!(string_space_match(
            "openid email profile",
            "profile openid email"
        ));
    }

    #[test]
    fn match_different_counts() {
        assert!(!string_space_match("a a b", "a b b"));
    }

    #[test]
    fn match_different_sets() {
        assert!(!string_space_match("a b", "a c"));
    }
}
