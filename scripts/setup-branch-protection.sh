#!/usr/bin/env bash
#
# Set up branch protection rules on main for newmatik/gerbtrace.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - Repository must exist on GitHub with at least one commit on main
#
# Usage: bash scripts/setup-branch-protection.sh

set -euo pipefail

REPO="newmatik/gerbtrace"

echo "Setting up branch protection ruleset for $REPO..."

gh api "repos/$REPO/rulesets" \
  --method POST \
  --input - <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          {
            "context": "Build & Verify"
          }
        ]
      }
    }
  ]
}
EOF

echo ""
echo "Branch protection ruleset created successfully!"
echo ""
echo "Rules applied to main:"
echo "  - Pull requests required (1 approval)"
echo "  - Stale reviews dismissed on new push"
echo "  - CI (Build & Verify) must pass"
