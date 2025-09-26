//! XSS security utilities for escaping and sanitizing untrusted strings.
#![allow(dead_code)]

/// Escape a string for safe HTML rendering. This replaces &, <, >, ", and ' with HTML entities.
pub fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#x27;"),
            _ => out.push(ch),
        }
    }
    out
}

/// Basic input sanitization for general text fields:
/// - Trim
/// - Remove ASCII control characters
/// - Optionally cap length
pub fn sanitize_input(input: &str, max_len: usize) -> String {
    let mut s = input.trim().to_string();
    s.retain(|ch| ch >= ' ');
    if s.len() > max_len {
        s.truncate(max_len);
    }
    s
}

/// Validate that a string contains only safe characters (letters, digits, space, underscore, dash, dot, at).
/// Returns true when valid, false otherwise.
pub fn validate_safe_string(input: &str) -> bool {
    input
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '_' | '-' | '.' | '@'))
}

/// Remove dangerous HTML tags indicators by stripping angle brackets. This is a coarse filter and should
/// be combined with escape_html before rendering.
pub fn strip_dangerous_tags(input: &str) -> String {
    input.replace('<', "").replace('>', "")
}
