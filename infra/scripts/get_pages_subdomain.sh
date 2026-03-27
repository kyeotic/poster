#!/bin/bash
# Reads account_id and project_name from stdin JSON, returns subdomain as JSON
set -euo pipefail

INPUT=$(cat)
ACCOUNT_ID=$(echo "$INPUT" | jq -r '.account_id')
PROJECT_NAME=$(echo "$INPUT" | jq -r '.project_name')

SUBDOMAIN=$(curl -sf \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}" \
  | jq -r '.result.subdomain')

jq -n --arg subdomain "$SUBDOMAIN" '{"subdomain": $subdomain}'
