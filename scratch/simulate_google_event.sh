#!/bin/bash

# Configuration
URL="http://localhost:3001/reviews/webhook/google-review"
SECRET="test-secret" # Ensure this matches WEBHOOK_SECRET in your .env

# Payload: {"reviewName": "accounts/TEST/locations/TEST/reviews/TEST", "locationName": "accounts/TEST/locations/TEST"}
# Base64: eyJyZXZpZXdOYW1lIjogImFjY291bnRzL1RFU1QvbG9jYXRpb25zL1RFU1QvcmV2aWV3cy9URVNUIiwgImxvY2F0aW9uTmFtZSI6ICJhY2NvdW50cy9URVNUL2xvY2F0aW9ucy9URVNUIn0=
DATA="eyJyZXZpZXdOYW1lIjogImFjY291bnRzL1RFU1QvbG9jYXRpb25zL1RFU1QvcmV2aWV3cy9URVNUIiwgImxvY2F0aW9uTmFtZSI6ICJhY2NvdW50cy9URVNUL2xvY2F0aW9ucy9URVNUIn0="

echo "Sending test event to $URL..."

curl -X POST "$URL?secret=$SECRET" \
     -H "Content-Type: application/json" \
     -d "{
       \"message\": {
         \"data\": \"$DATA\",
         \"messageId\": \"simulated-$(date +%s)\"
       }
     }"

echo -e "\nDone. Check server logs."
