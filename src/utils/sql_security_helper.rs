//! SQL security utilities: whitelist-based validation and safe helpers for dynamic queries.
#![allow(dead_code)]

/// Validate a column name against an allowed whitelist.
/// Returns `default_col` when the provided column is not in the list.
pub fn validate_column_name<'a>(
    column: &'a str,
    allowed: &'a [&str],
    default_col: &'a str,
) -> &'a str {
    if allowed.iter().any(|c| *c == column) {
        column
    } else {
        default_col
    }
}

/// Normalize order type to either "ASC" or "DESC" (defaults to ASC).
pub fn normalize_order_type(order_type: &str) -> &'static str {
    match order_type.to_ascii_uppercase().as_str() {
        "DESC" => "DESC",
        _ => "ASC",
    }
}

/// Validate ORDER BY clause parts using a whitelist and normalization.
/// Returns a tuple of (safe_column, safe_order_type).
pub fn validate_order_clause(
    order_by: &str,
    order_type: &str,
    allowed: &[&str],
    default_col: &str,
) -> (String, String) {
    let col = validate_column_name(order_by, allowed, default_col).to_string();
    let ord = normalize_order_type(order_type).to_string();
    (col, ord)
}

/// Sanitize a free-text search keyword so it is safe to be used inside a LIKE pattern.
/// This function:
/// - Trims whitespace
/// - Lowercases
/// - Removes control characters
/// - Escapes or removes wildcard characters to avoid excessive wildcard amplification
/// - Limits length to a reasonable size
pub fn sanitize_search_keyword(input: &str) -> String {
    let mut s = input.trim().to_lowercase();
    // Remove ASCII control chars
    s.retain(|ch| ch >= ' ');
    // Replace consecutive whitespace with a single space
    let collapsed = s.split_whitespace().collect::<Vec<_>>().join(" ");
    // Escape Postgres wildcards by removing them. Another option is to escape with ESCAPE, but
    // the repositories build the pattern as %keyword%, so removing embedded wildcards is simpler.
    let without_wildcards = collapsed.replace('%', "").replace('_', "");
    // Hard cap length to avoid performance issues in LIKE
    let mut capped = without_wildcards;
    if capped.len() > 120 {
        capped.truncate(120);
    }
    capped
}
