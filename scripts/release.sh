#!/usr/bin/env bash
set -euo pipefail

# Release helper for vscode-fff-gpui
# Publishes to both VS Code Marketplace and Open VSX Registry
#
# ── Prerequisites ─────────────────────────────────────
#
#   VS Code Marketplace:
#     1. Sign into https://dev.azure.com/ with your publisher account
#     2. Create a PAT with "Marketplace (Publish)" scope at
#        https://dev.azure.com/ (User Settings → Personal Access Tokens)
#     3. Set:  export VS_MARKETPLACE_TOKEN="your-pat-here"
#
#   Open VSX Registry:
#     1. Go to https://open-vsx.org/user-settings/tokens
#     2. Create an access token (requires GitHub login)
#     3. Set:  export OPEN_VSX_TOKEN="your-token-here"
#
#   Tip: add both tokens to ~/.bashrc or ~/.zshrc so they persist.
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
  echo "VS Code Marketplace needs a Personal Access Token (PAT):"
  echo "  1. Sign in at https://dev.azure.com/"
  echo "  2. User Settings → Personal Access Tokens → New Token"
  echo "  3. Scope: Marketplace (Publish)"
  echo "  4. export VS_MARKETPLACE_TOKEN=\"your-pat-here\""
  echo ""
  echo "Open VSX Registry needs an access token:"
  echo "  1. Go to https://open-vsx.org/user-settings/tokens"
  echo "  2. Create a new access token"
  echo "  3. export OPEN_VSX_TOKEN=\"your-token-here\""
  echo ""

  echo "Opening token pages in browser..."
  if command -v open &>/dev/null; then
    open "https://open-vsx.org/user-settings/tokens"
    open "https://dev.azure.com/"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "https://open-vsx.org/user-settings/tokens"
    xdg-open "https://dev.azure.com/"
  else
    echo "(could not auto-open browser — open the URLs above)"
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
  echo "   Before publishing, set up tokens:"
  echo "     ./scripts/release.sh --setup"
  echo ""
  echo "   Or publish manually:"
  echo "     export OPEN_VSX_TOKEN=\"...\""
  echo "     export VS_MARKETPLACE_TOKEN=\"...\""
  echo "     npx ovsx publish $VSIX --pat \"\$OPEN_VSX_TOKEN\""
  echo "     npx vsce publish --packagePath $VSIX -p \"\$VS_MARKETPLACE_TOKEN\""
  exit 0
fi

# Check tokens
if [[ -z "${OPEN_VSX_TOKEN:-}" ]]; then
  echo ""
  echo "❌ OPEN_VSX_TOKEN is not set"
  echo "   Get it at: https://open-vsx.org/user-settings/tokens"
  echo "   Or run: ./scripts/release.sh --setup"
  exit 1
fi

if [[ -z "${VS_MARKETPLACE_TOKEN:-}" ]]; then
  echo ""
  echo "❌ VS_MARKETPLACE_TOKEN is not set"
  echo "   Get it at: https://dev.azure.com/ (User Settings → Personal Access Tokens)"
  echo "   Or run: ./scripts/release.sh --setup"
  exit 1
fi

# Open VSX Registry
echo ""
echo "🚀 Publishing to Open VSX Registry…"
npx ovsx publish "$VSIX" --pat "$OPEN_VSX_TOKEN"
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
echo "     Open VSX:  https://open-vsx.org/extension/jellydn/vscode-fff-gpui"
echo "     VS Code:   https://marketplace.visualstudio.com/items?itemName=jellydn.vscode-fff-gpui"
echo "══════════════════════════════════════════"
