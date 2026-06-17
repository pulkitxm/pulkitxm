#!/bin/bash

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
README_PATH="$REPO_DIR/README.md"
API_URL="https://pulkitxm.com/api/blogs"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting blog update..."

# Fetch blogs from API
BLOGS_JSON=$(curl -s "$API_URL" 2>/dev/null || echo "[]")

if [ "$BLOGS_JSON" = "[]" ] || [ -z "$BLOGS_JSON" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Failed to fetch blogs from $API_URL"
  exit 1
fi

# Sort by date descending and get top 5
BLOGS=$(echo "$BLOGS_JSON" | jq -r '.data | sort_by(.date) | reverse | .[0:5] | .[] | "- [\(.title)](https://pulkitxm.com\(.url))"' 2>/dev/null)

if [ -z "$BLOGS" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Failed to parse blogs JSON"
  exit 1
fi

# Get line numbers for markers
START_LINE=$(grep -n "## I write about what I learn" "$README_PATH" | cut -d: -f1)
END_LINE=$(tail -n +$((START_LINE + 4)) "$README_PATH" | grep -n "^→" | head -1 | cut -d: -f1)
END_LINE=$((START_LINE + 3 + END_LINE - 1))

# Extract current blogs section
CURRENT_BLOGS=$(sed -n "$((START_LINE + 3)),$((END_LINE - 2))p" "$README_PATH")

# Compare
if [ "$BLOGS" = "$CURRENT_BLOGS" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] No changes detected. Skipping commit."
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updates found. Generating new README..."

# Create new README with updated blogs
{
  sed -n "1,$((START_LINE + 2))p" "$README_PATH"
  echo "$BLOGS"
  echo ""
  sed -n "$((END_LINE)),\$p" "$README_PATH"
} > "$README_PATH.tmp"

mv "$README_PATH.tmp" "$README_PATH"

# Commit and push
cd "$REPO_DIR"
git add README.md
git commit -m "chore: update latest blogs from pulkitxm.com"
git push origin main

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Successfully updated and committed blogs."
