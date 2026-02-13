#!/usr/bin/env bash
#
# Configure GitHub repository secrets for Apple code signing and notarization.
#
# Prerequisites:
#   - gh CLI installed and authenticated
#   - Developer ID Application certificate exported as .p12
#   - App Store Connect API key (.p8 file)
#
# Usage: bash scripts/setup-apple-signing.sh
#
# Required arguments (set via environment or prompted):
#   P12_PATH          - Path to the .p12 certificate file
#   P12_PASSWORD      - Password for the .p12 file
#   API_KEY_PATH      - Path to the .p8 API key file
#   API_KEY_ID        - App Store Connect API Key ID
#   API_ISSUER_ID     - App Store Connect Issuer ID
#   SIGNING_IDENTITY  - Apple signing identity string

set -euo pipefail

REPO="newmatik/gerbtrace"

P12_PATH="${P12_PATH:-$HOME/Downloads/developer-certificate.p12}"
API_KEY_PATH="${API_KEY_PATH:-$HOME/Downloads/AuthKey_V9PG8SB5AS.p8}"
API_KEY_ID="${API_KEY_ID:-V9PG8SB5AS}"
API_ISSUER_ID="${API_ISSUER_ID:-6b1b03f4-4628-4674-8067-6d5f6440350f}"
SIGNING_IDENTITY="${SIGNING_IDENTITY:-Developer ID Application: Dominik Ottenbreit (37L799SG9S)}"

# Prompt for p12 password
if [ -z "${P12_PASSWORD:-}" ]; then
  echo -n "Enter .p12 certificate password: "
  read -rs P12_PASSWORD
  echo ""
fi

# Verify files exist
for f in "$P12_PATH" "$API_KEY_PATH"; do
  if [ ! -f "$f" ]; then
    echo "Error: File not found: $f"
    exit 1
  fi
done

echo "Setting up Apple signing secrets for $REPO..."
echo ""

# Generate a random keychain password for CI
KEYCHAIN_PWD=$(openssl rand -base64 32)

# Base64-encode the certificate
CERT_BASE64=$(openssl base64 -A -in "$P12_PATH")

# Base64-encode the API key
API_KEY_BASE64=$(openssl base64 -A -in "$API_KEY_PATH")

echo "Setting APPLE_CERTIFICATE..."
echo "$CERT_BASE64" | gh secret set APPLE_CERTIFICATE --repo "$REPO"

echo "Setting APPLE_CERTIFICATE_PASSWORD..."
echo "$P12_PASSWORD" | gh secret set APPLE_CERTIFICATE_PASSWORD --repo "$REPO"

echo "Setting APPLE_SIGNING_IDENTITY..."
echo "$SIGNING_IDENTITY" | gh secret set APPLE_SIGNING_IDENTITY --repo "$REPO"

echo "Setting APPLE_API_ISSUER..."
echo "$API_ISSUER_ID" | gh secret set APPLE_API_ISSUER --repo "$REPO"

echo "Setting APPLE_API_KEY..."
echo "$API_KEY_ID" | gh secret set APPLE_API_KEY --repo "$REPO"

echo "Setting APPLE_API_KEY_CONTENT..."
echo "$API_KEY_BASE64" | gh secret set APPLE_API_KEY_CONTENT --repo "$REPO"

echo "Setting KEYCHAIN_PASSWORD..."
echo "$KEYCHAIN_PWD" | gh secret set KEYCHAIN_PASSWORD --repo "$REPO"

echo ""
echo "Apple signing secrets configured successfully!"
echo ""
echo "Secrets set:"
echo "  - APPLE_CERTIFICATE (base64-encoded .p12)"
echo "  - APPLE_CERTIFICATE_PASSWORD"
echo "  - APPLE_SIGNING_IDENTITY ($SIGNING_IDENTITY)"
echo "  - APPLE_API_ISSUER ($API_ISSUER_ID)"
echo "  - APPLE_API_KEY ($API_KEY_ID)"
echo "  - APPLE_API_KEY_CONTENT (base64-encoded .p8)"
echo "  - KEYCHAIN_PASSWORD (random)"
