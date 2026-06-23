#!/usr/bin/env bash
set -euo pipefail

# Release helper for vscode-fff-gpui
# Publishes to both VS Code Marketplace and Open VSX Registry
#
# ── Prerequisites ─────────────────────────────────────
#
#   VS Code Marketplace (Entra ID via Azure CLI):
#     1. Install Azure CLI:  brew install azure-cli
#     2. Log in:             az login
#     3. Ensure you have a publisher at https://marketplace.visualstudio.com/manage
#     4. Requires vsce >= 2.26.1 (already a devDependency)
#
#   Open VSX Registry:
#     1. Go to https://open-vsx.org/user-settings/tokens
#     2. Create an access token (requires GitHub login)
#     3. Set:  export OPEN_VSX_TOKEN="your-token-here"
#
#   Tip: add OPEN_VSX_TOKEN to ~/.bashrc or ~/.zshrc so it persists.
#
# Usage:
#   ./scripts/release.sh              # full release to both registries
#   ./scripts/release.sh --dry-run    # build + package only, no publish
#   ./scripts/release.sh --setup      # print setup guide and open URLs

DRY_RUN=false
SETUP_ONLY=false
if [[ "${1:-}" == "--setup" ]]; then
  SETUP_ONLY=true
elif [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if $SETUP_ONLY; then
  echo ""
  echo "══════════════════════════════════════════"
  echo "  🔑 Setup Guide"
  echo "══════════════════════════════════════════"
  echo ""
  echo "VS Code Marketplace uses Microsoft Entra ID authentication."
  echo "No PAT needed:"
  echo ""
  echo "  One-time setup:"
  echo "  1. Install:    brew install azure-cli"
  echo "  2. Log in:     az login"
  echo "  3. Init org:   Sign in at https://dev.azure.com/ and create a free org (e.g. jellydn)"
  echo "  4. Get ID:     az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798"
  echo "  5. Add member: https://marketplace.visualstudio.com/manage/publishers → jellydn → Members → Add ID (Contributor)"
  echo "  3. Verify:   az account show"
  echo ""
  echo "Open VSX Registry needs an access token:"
  echo "  URL: https://open-vsx.org/user-settings/tokens"
  echo "  Then: export OPEN_VSX_TOKEN=\"your-token-here\""
  echo ""
  echo "Opening token page in browser..."

  if command -v open &>/dev/null; then
    open "https://open-vsx.org/user-settings/tokens"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "https://open-vsx.org/user-settings/tokens"
  fi

  echo ""
  echo "Once set up, run: ./scripts/release.sh"
  exit 0
fi

if $DRY_RUN; then
  echo "🔍 Dry run mode — will build and package but NOT publish"
fi

echo ""
echo "══════════════════════════════════════════"
echo "  vscode-fff-gpui Release"
echo "══════════════════════════════════════════"
echo ""

# ── CI checks ──────────────────────────────────────────

echo "📋 Lint…"
pnpm lint

echo ""
echo "🔎 Typecheck…"
pnpm typecheck

echo ""
echo "🧪 Tests…"
pnpm test

echo ""
echo "📦 Build…"
pnpm build

# ── Package ────────────────────────────────────────────

echo ""
echo "📦 Packaging VSIX…"
pnpm package

VERSION=$(node -p "require('./package.json').version")
VSIX="vscode-fff-gpui-${VERSION}.vsix"
if [[ ! -f "$VSIX" ]]; then
  echo "❌ Expected VSIX not found: $VSIX"
  exit 1
fi
echo "   → $VSIX ($(du -h "$VSIX" | cut -f1))"

# ── Publish ────────────────────────────────────────────

if $DRY_RUN; then
  echo ""
  echo "✅ Dry run complete. VSIX is ready: $VSIX"
  echo ""
  echo "   Before publishing:"
  echo "     VS Code:  az login (Entra ID — no PAT needed)"
  echo "     Open VSX: https://open-vsx.org/user-settings/tokens"
  echo ""
  echo "   Then run:"
  echo "     export OPEN_VSX_TOKEN=\"your-token-here\""
  echo "     npx ovsx publish $VSIX --pat \"\$OPEN_VSX_TOKEN\""
  echo "     npx vsce publish --packagePath $VSIX --azure-credential"
  echo ""
  echo "   Or just run the full release:"
  echo "     ./scripts/release.sh"
  exit 0
fi

# Check Open VSX token
if [[ -z "${OPEN_VSX_TOKEN:-}" ]]; then
  echo ""
  echo "❌ OPEN_VSX_TOKEN is not set"
  echo "   Get it at: https://open-vsx.org/user-settings/tokens"
  echo ""
  echo "   Then: export OPEN_VSX_TOKEN=\"your-token-here\""
  echo "   Or run: ./scripts/release.sh --setup"
  exit 1
fi

# Open VSX Registry
echo ""
echo "🚀 Publishing to Open VSX Registry…"
npx ovsx publish "$VSIX" --pat "$OPEN_VSX_TOKEN"
echo "   ✅ Open VSX published"

# VS Code Marketplace (Entra ID via Azure CLI)
echo ""
echo "🚀 Publishing to VS Code Marketplace…"
if ! az account show &>/dev/null; then
  echo ""
  echo "❌ Not logged into Azure. Run: az login"
  echo "   Or: ./scripts/release.sh --setup"
  exit 1
fi
npx vsce publish --packagePath "$VSIX" --azure-credential
echo "   ✅ VS Code Marketplace published"

# ── Done ───────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Release complete!"echo "     Open VSX:  https://open-vsx.org/extension/jellydn/vscode-fff-gpui"
     echo "     VS Code:   https://marketplace.visualstudio.com/items?itemName=jellydn.vscode-fff-gpui"
echo "══════════════════════════════════════════"
