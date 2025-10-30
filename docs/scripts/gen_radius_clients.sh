#!/bin/bash

# Script to generate radius_clients INSERT queries
# Appends SQL INSERT statements to radius_clients.sql file

TARGET_FILE="radius_clients.sql"

# Loop from 3 to 254
for i in {3..254}
do
    # Generate a new UUID for each iteration using the Python script
    UUID=$(py gen_uuid.py)
    
    # Build the IP address and name
    IP_ADDRESS="10.8.9.$i"
    NAME="$IP_ADDRESS"
    
    # Append the INSERT query to the file
    cat >> "$TARGET_FILE" << EOF

INSERT INTO radius_clients (
	id,
	nas_id,
	ip_address,
	name,
	secret,
	description,
	is_use
)
VALUES (
	'$UUID',
	NULL,
	'$IP_ADDRESS',
	'$NAME',
	NULL,
	NULL,
	FALSE
);
EOF

    echo "Added entry for $IP_ADDRESS with UUID $UUID"
done

echo "Done! Generated $(expr 254 - 3 + 1) INSERT queries in $TARGET_FILE"
