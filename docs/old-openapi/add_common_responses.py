#!/usr/bin/env python3
"""
Script to add common responses to all group OpenAPI files
This resolves the $ref resolution issue when bundling with Redocly
"""

import json
import os
from pathlib import Path

# Common responses yang akan ditambahkan ke setiap file group
COMMON_RESPONSES = {
    "BadRequest": {
        "description": "Bad Request - Invalid input parameters or validation errors",
        "headers": {
            "x-request-id": {
                "schema": {"type": "string"},
                "description": "Request identifier for tracing"
            }
        },
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "object",
                            "properties": {
                                "code": {"type": "integer", "example": 400},
                                "message": {"type": "string", "example": "Bad Request"}
                            }
                        },
                        "request_id": {
                            "type": "string",
                            "nullable": True,
                            "example": "req_abc123xyz"
                        },
                        "data": {
                            "type": "object",
                            "properties": {
                                "errors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "example": ["name is required", "device_type_id must be a valid UUID"]
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    "NotFound": {
        "description": "Not Found - Resource does not exist",
        "headers": {
            "x-request-id": {
                "schema": {"type": "string"},
                "description": "Request identifier for tracing"
            }
        },
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "object",
                            "properties": {
                                "code": {"type": "integer", "example": 404},
                                "message": {"type": "string", "example": "Not Found"}
                            }
                        },
                        "request_id": {
                            "type": "string",
                            "nullable": True,
                            "example": "req_abc123xyz"
                        },
                        "data": {
                            "type": "object",
                            "properties": {
                                "errors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "example": ["Resource not found"]
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    "InternalServerError": {
        "description": "Internal Server Error - An unexpected error occurred",
        "headers": {
            "x-request-id": {
                "schema": {"type": "string"},
                "description": "Request identifier for tracing"
            }
        },
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "object",
                            "properties": {
                                "code": {"type": "integer", "example": 500},
                                "message": {"type": "string", "example": "Internal Server Error"}
                            }
                        },
                        "request_id": {
                            "type": "string",
                            "nullable": True,
                            "example": "req_abc123xyz"
                        },
                        "data": {
                            "type": "object",
                            "properties": {
                                "errors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "example": ["An internal error occurred"]
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

def add_common_responses_to_file(filepath):
    """Add common responses to a group file"""
    print(f"Processing {filepath.name}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Ensure components section exists
    if 'components' not in data:
        data['components'] = {}
    
    # Ensure responses section exists in components
    if 'responses' not in data['components']:
        data['components']['responses'] = {}
    
    # Add common responses
    data['components']['responses'].update(COMMON_RESPONSES)
    
    # Write back with proper formatting
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Added common responses to {filepath.name}")

def main():
    # Get script directory
    script_dir = Path(__file__).parent
    
    # List of group files
    group_files = [
        'group_device.json',
        'group_device_type.json',
        'group_device_port.json',
        'group_device_port_specification.json',
        'group_device_port_interface.json',
        'group_device_connection.json',
        'group_branch_topology.json'
    ]
    
    print("🔧 Adding common responses to all group files...\n")
    
    for filename in group_files:
        filepath = script_dir / filename
        if filepath.exists():
            add_common_responses_to_file(filepath)
        else:
            print(f"⚠ Warning: {filename} not found, skipping...")
    
    print("\n✨ Done! All group files updated.")
    print("💡 Now you can run: redocly bundle infrastructure_service_adminradius.json -o bundled.json")

if __name__ == '__main__':
    main()
