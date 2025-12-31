use handlebars::Handlebars;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScriptBuilderError {
    #[error("template rendering failed: {0}")]
    RenderError(#[from] handlebars::RenderError),
    #[error("template parsing failed: {0}")]
    TemplateError(#[from] handlebars::TemplateError),
}

/// Renders a script template with the provided data using Handlebars.
/// 
/// This function is designed for RouterOS and similar non-HTML scripts,
/// so HTML escaping is disabled.
/// 
/// # Arguments
/// * `template` - The script template text containing {{variable}} placeholders
/// * `data` - JSON object with key-value pairs to substitute into the template
/// 
/// # Returns
/// * `Ok(String)` - The rendered script with all placeholders replaced
/// * `Err(ScriptBuilderError)` - If template parsing or rendering fails
/// 
/// # Example
/// ```
/// let template = "interface add name={{interface_name}} user={{username}}";
/// let data = serde_json::json!({"interface_name": "pppoe1", "username": "admin"});
/// let result = render_script(template, &data)?;
/// // result: "interface add name=pppoe1 user=admin"
/// ```
pub fn render_script(template: &str, data: &serde_json::Value) -> Result<String, ScriptBuilderError> {
    let mut handlebars = Handlebars::new();
    
    // Disable HTML escaping - this is for RouterOS scripts, not HTML
    handlebars.register_escape_fn(handlebars::no_escape);
    
    // Register the template with a temporary name
    handlebars.register_template_string("script", template)?;
    
    // Render the template with provided data
    let rendered = handlebars.render("script", data)?;
    
    Ok(rendered)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_render_simple_template() {
        let template = "Hello {{name}}!";
        let data = json!({"name": "World"});
        let result = render_script(template, &data).unwrap();
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_render_router_script() {
        let template = "/interface pppoe-client add name={{interface_name}} user={{username}} password={{password}}";
        let data = json!({
            "interface_name": "pppoe-out1",
            "username": "user@isp.com",
            "password": "secret123"
        });
        let result = render_script(template, &data).unwrap();
        assert_eq!(result, "/interface pppoe-client add name=pppoe-out1 user=user@isp.com password=secret123");
    }

    #[test]
    fn test_no_html_escaping() {
        let template = "value={{special}}";
        let data = json!({"special": "<script>alert('xss')</script>"});
        let result = render_script(template, &data).unwrap();
        // Should NOT escape HTML characters
        assert_eq!(result, "value=<script>alert('xss')</script>");
    }

    #[test]
    fn test_missing_variable_renders_empty() {
        let template = "Hello {{name}}!";
        let data = json!({});
        let result = render_script(template, &data).unwrap();
        assert_eq!(result, "Hello !");
    }
}
