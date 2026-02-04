#!/bin/bash

# Test script for campaign automation cron endpoint
# Usage: ./test-cron.sh

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Get CRON_SECRET from environment
if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET not set in .env.local"
  echo "Please add: CRON_SECRET=your_secure_random_string"
  exit 1
fi

# Default to localhost if APP_URL not set
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

echo "Testing cron endpoint at: ${APP_URL}/api/cron/check-campaigns"
echo "Using CRON_SECRET: ${CRON_SECRET:0:10}..."
echo ""

# Make the request
curl -X POST "${APP_URL}/api/cron/check-campaigns" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response (no jq):"

echo ""
echo "Test complete!"
