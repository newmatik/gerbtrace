#!/usr/bin/env bash
#
# Configure GitHub repository secrets for Tauri desktop app signing.
#
# The signing keypair enables automatic updates. The private key signs
# release artifacts, and the public key (in tauri.conf.json) verifies them.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - Signing keypair generated: npx tauri signer generate -w src-tauri/.tauri-private-key
#
# Usage: bash scripts/setup-github-secrets.sh

set -euo pipefail

REPO="newmatik/gerbtrace"
KEY_PATH="src-tauri/.tauri-private-key"

if [ ! -f "$KEY_PATH" ]; then
  echo "Error: Private key not found at $KEY_PATH"
  echo "Generate one with: npx tauri signer generate -w $KEY_PATH"
  exit 1
fi

echo "Setting up GitHub secrets for $REPO..."
echo ""

# Set the signing private key
echo "Setting TAURI_SIGNING_PRIVATE_KEY..."
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo "$REPO" < "$KEY_PATH"

# Set empty password (key was generated without a password)
echo "Setting TAURI_SIGNING_PRIVATE_KEY_PASSWORD..."
echo -n "" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo "$REPO"

echo ""
echo "GitHub secrets configured successfully!"
echo ""
echo "Secrets set:"
echo "  - TAURI_SIGNING_PRIVATE_KEY (from $KEY_PATH)"
echo "  - TAURI_SIGNING_PRIVATE_KEY_PASSWORD (empty)"
echo ""
echo "The public key is already configured in src-tauri/tauri.conf.json."
echo "Push a version tag (e.g., git tag v1.0.0 && git push origin v1.0.0)"
echo "to trigger a signed desktop build."
