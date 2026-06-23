#!/usr/bin/env bash
set -euo pipefail

# Release helper for vscode-fff-gpui
# Publishes to both VS Code Marketplace and Open VSX Registry
#
# Prerequisites:
#   export VS_MARKETPLACE_TOKEN="your-vsce-pat"
#   export OPEN_VSX_TOKEN="your-open-vsx-pat"
#
# Usage:
#   ./scripts/release.sh              # full release to both registries
#   ./scripts/release.sh --dry-run    # build + package only, no publish

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
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
  echo "   To publish, run:"
  echo "     npx ovsx publish $VSIX -p \"\$OPEN_VSX_TOKEN\""
  echo "     npx vsce publish --packagePath $VSIX -p \"\$VS_MARKETPLACE_TOKEN\""
  exit 0
fi

# Check tokens
if [[ -z "${VS_MARKETPLACE_TOKEN:-}" ]]; then
  echo "❌ VS_MARKETPLACE_TOKEN is not set"
  echo "   Get it from https://dev.azure.com/ → Personal Access Tokens"
  exit 1
fi
if [[ -z "${OPEN_VSX_TOKEN:-}" ]]; then
  echo "❌ OPEN_VSX_TOKEN is not set"
  echo "   Get it from https://open-vsx.org/user-settings/tokens"
  exit 1
fi

# Open VSX Registry
echo ""
echo "🚀 Publishing to Open VSX Registry…"
npx ovsx publish "$VSIX" -p "$OPEN_VSX_TOKEN"
echo "   ✅ Open VSX published"

# VS Code Marketplace
echo ""
echo "🚀 Publishing to VS Code Marketplace…"
npx vsce publish --packagePath "$VSIX" -p "$VS_MARKETPLACE_TOKEN"
echo "   ✅ VS Code Marketplace published"

# ── Done ───────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Release complete!"
echo "     Open VSX:  https://open-vsx.org/extension/jellydn/fff-gpui"
echo "     VS Code:   https://marketplace.visualstudio.com/items?itemName=jellydn.fff-gpui"
echo "══════════════════════════════════════════"
