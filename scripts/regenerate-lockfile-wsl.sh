#!/usr/bin/env bash
set -euo pipefail

# Prefer running in the current directory when invoked from a WSL-native clone.
# Fallback to the Windows-mounted path if not running inside WSL or if
# the current directory is not the repo root.
REPO="/mnt/c/Users/pageb/Documents/GitHub/Hostack-Deploy"
if [ -f /proc/version ] && grep -iq "microsoft\|wsl" /proc/version 2>/dev/null; then
  if [ -d "$(pwd)/.git" ]; then
    REPO="$(pwd)"
  fi
else
  REPO="${1:-$REPO}"
fi
cd "$REPO"

echo "Fetching origin and ensuring branch exists..."
git fetch origin
if git rev-parse --verify --quiet ci/regenerate-pnpm-lockfile-linux >/dev/null; then
  git checkout ci/regenerate-pnpm-lockfile-linux
else
  git checkout -b ci/regenerate-pnpm-lockfile-linux
fi

echo "Removing existing pnpm-lock.yaml (if any)"
rm -f pnpm-lock.yaml

# Ensure Node + build tools in WSL
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js and build tools in WSL..."
  sudo apt-get update -y
  sudo apt-get install -y curl ca-certificates gnupg build-essential git
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Ensure pnpm available
corepack enable || true
corepack prepare pnpm@latest --activate || true

echo "Running pnpm install (this may take a few minutes)..."
pnpm install --reporter=silent

echo "Committing lockfile if changed"
git add pnpm-lock.yaml || true
if ! git diff --staged --quiet; then
  git commit -m "chore(ci): regenerate pnpm-lock.yaml for Linux"
else
  echo "no changes to commit"
fi

echo "Pushing branch to origin"
git push --set-upstream origin ci/regenerate-pnpm-lockfile-linux

echo "done"
