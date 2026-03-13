#!/usr/bin/env bash
# publish-release.sh — Squash-publish from CASTM-dev to CASTM (public release repo)
#
# Usage:
#   ./publish-release.sh v0.1.0 "Initial CASTM release"
#   ./publish-release.sh v0.2.0                          # auto-generates changelog
#   ./publish-release.sh                                 # version = date, auto changelog
#
# Result in public repo: ONE commit per release with a changelog body
# summarizing all dev commits since the last publish.
#
set -euo pipefail

# --- Configuration ---
PUBLIC_REPO="https://github.com/PhDCristian/CASTM.git"
RELEASE_DIR="/tmp/castm-release"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
LAST_RELEASE_FILE="$SOURCE_DIR/.last-release-sha"

# --- Args ---
DATE=$(date +%Y-%m-%d)
VERSION="${1:-"$DATE"}"
TITLE="${2:-"Release $VERSION"}"

# --- Build changelog from dev commits since last publish ---
build_changelog() {
    local since_sha=""
    if [ -f "$LAST_RELEASE_FILE" ]; then
        since_sha=$(cat "$LAST_RELEASE_FILE")
    fi

    cd "$SOURCE_DIR"
    echo "## What's Changed"
    echo ""
    if [ -n "$since_sha" ] && git rev-parse "$since_sha" >/dev/null 2>&1; then
        git log --oneline "$since_sha"..HEAD | sed 's/^[a-f0-9]* /- /'
    else
        # First release — summarize all commits (last 50 max)
        git log --oneline -50 | sed 's/^[a-f0-9]* /- /'
    fi
    echo ""
    echo "---"
    echo "Published from CASTM-dev @ $(git rev-parse --short HEAD) on $DATE"
}

echo "=== CASTM Publish Release ==="
echo "Source:  $SOURCE_DIR (CASTM-dev)"
echo "Target:  $PUBLIC_REPO"
echo "Version: $VERSION"
echo ""

# --- Step 1: Clone or update local copy of public repo ---
if [ -d "$RELEASE_DIR/.git" ]; then
    echo "[1/5] Updating existing clone..."
    cd "$RELEASE_DIR"
    git fetch origin 2>/dev/null || true
    git reset --hard origin/main 2>/dev/null || git reset --hard HEAD
else
    echo "[1/5] Cloning public repo..."
    rm -rf "$RELEASE_DIR"
    git clone "$PUBLIC_REPO" "$RELEASE_DIR" 2>/dev/null || {
        # Empty repo — initialize locally
        mkdir -p "$RELEASE_DIR"
        cd "$RELEASE_DIR"
        git init
        git remote add origin "$PUBLIC_REPO"
        git checkout -b main
    }
fi

cd "$RELEASE_DIR"

# --- Step 2: Clean all tracked files (keep .git) ---
echo "[2/5] Cleaning release directory..."
git rm -rf --quiet . 2>/dev/null || true
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

# --- Step 3: Copy current state from working repo (git-tracked files only) ---
echo "[3/5] Exporting current state from CASTM-dev..."
cd "$SOURCE_DIR"
# git archive exports only tracked files (respects .gitignore, excludes .git/)
git archive HEAD | tar -x -C "$RELEASE_DIR"

cd "$RELEASE_DIR"

# Remove dev-only files from public release
rm -f publish-release.sh .last-release-sha .release-ignore

# Remove paths listed in .release-ignore (one glob pattern per line)
IGNORE_FILE="$SOURCE_DIR/.release-ignore"
if [ -f "$IGNORE_FILE" ]; then
    echo "    Applying .release-ignore exclusions..."
    while IFS= read -r pattern || [ -n "$pattern" ]; do
        # Skip empty lines and comments
        [[ -z "$pattern" || "$pattern" =~ ^# ]] && continue
        # Use bash glob expansion to remove matching paths
        cd "$RELEASE_DIR"
        for match in $pattern; do
            if [ -e "$match" ]; then
                echo "    - excluding: $match"
                rm -rf "$match"
            fi
        done
    done < "$IGNORE_FILE"
fi

# --- Step 4: Stage and check for changes ---
git add -A

if git diff --cached --quiet 2>/dev/null; then
    echo ""
    echo "No changes to publish. Public repo is already up to date."
    exit 0
fi

# --- Step 5: Build changelog and commit ---
echo "[4/5] Building changelog..."
CHANGELOG=$(build_changelog)

COMMIT_MSG="$TITLE

$CHANGELOG"

echo ""
echo "=== Commit Message ==="
echo "$COMMIT_MSG"
echo ""
echo "=== Files Changed ==="
git diff --cached --stat
echo ""

echo "[5/5] Creating release commit..."
git commit -m "$COMMIT_MSG"

read -p "Push to PhDCristian/CASTM? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    git push -u origin main
    # Save the dev SHA so next release knows where to start the changelog
    cd "$SOURCE_DIR"
    git rev-parse HEAD > "$LAST_RELEASE_FILE"
    echo ""
    echo "Published! https://github.com/PhDCristian/CASTM"
else
    echo ""
    echo "Aborted. Changes are staged in $RELEASE_DIR"
    echo "You can push manually:"
    echo "  cd $RELEASE_DIR && git push -u origin main"
fi
