#!/bin/sh
# Signs the Firefox extension as unlisted. API keys are read from the macOS Keychain:
#   security add-generic-password -a "$USER" -s amo-api-key -w
#   security add-generic-password -a "$USER" -s amo-api-secret -w
set -e
cd "$(dirname "$0")/extension"

WEB_EXT_API_KEY=$(security find-generic-password -a "$USER" -s amo-api-key -w) || { echo "Missing amo-api-key in Keychain"; exit 1; }
WEB_EXT_API_SECRET=$(security find-generic-password -a "$USER" -s amo-api-secret -w) || { echo "Missing amo-api-secret in Keychain"; exit 1; }
export WEB_EXT_API_KEY WEB_EXT_API_SECRET

npx --yes web-ext sign --channel=unlisted --ignore-files "web-ext-artifacts/**" "icons/icon.html" "icons/twemoji/**"
