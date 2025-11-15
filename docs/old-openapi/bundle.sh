#!/bin/bash

# Bundle OpenAPI Documentation Script
# Usage: ./bundle.sh [output_path] [format]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_PATH="${1:-../../final_infra_adminradius.json}"
FORMAT="${2:-json}"

echo "🚀 Bundling AdminRadius Infrastructure API Documentation..."
echo "📁 Source: infrastructure_service_adminradius.json"
echo "📄 Output: $OUTPUT_PATH"
echo "📋 Format: $FORMAT"
echo ""

# Check if redocly is installed
if ! command -v redocly &> /dev/null; then
    echo "❌ Error: redocly CLI not found!"
    echo "📦 Install with: npm install -g @redocly/cli"
    exit 1
fi

# Ensure common responses are added to group files
echo "🔧 Ensuring common responses in all group files..."
if [ -f "add_common_responses.py" ]; then
    python3 add_common_responses.py > /dev/null 2>&1
    echo "✓ Common responses updated"
else
    echo "⚠ Warning: add_common_responses.py not found, skipping..."
fi
echo ""

# Validate first
echo "✅ Validating OpenAPI spec..."
redocly lint infrastructure_service_adminradius.json || {
    echo "⚠ Warning: Validation issues found, but continuing with bundle..."
}
echo ""

# Bundle
echo "📦 Bundling files..."
if [ "$FORMAT" = "yaml" ]; then
    redocly bundle infrastructure_service_adminradius.json \
        --ext yaml \
        -o "$OUTPUT_PATH"
else
    redocly bundle infrastructure_service_adminradius.json \
        -o "$OUTPUT_PATH"
fi

echo ""
echo "✨ Bundle complete!"
echo "📍 Output file: $(realpath "$OUTPUT_PATH")"
echo ""
echo "💡 Next steps:"
echo "   - View stats: redocly stats $OUTPUT_PATH"
echo "   - Preview: redocly preview-docs $OUTPUT_PATH"
echo ""
