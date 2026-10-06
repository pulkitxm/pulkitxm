#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
feed=$(mktemp)
trap 'rm -f "$feed"' EXIT
curl --proto '=https' --tlsv1.2 -fsSL --retry 3 --max-time 60 \
  https://pulkit.blog/feed.xml -o "$feed"
python3 scripts/update-blogs.py "$feed" README.md
git add -- README.md
if git diff --cached --quiet -- README.md; then
  echo 'The latest blog list is already current.'
else
  pukbot commit create --repo pulkitxm/pulkitxm --branch main \
    --message 'Update latest blogs from pulkit.blog' README.md --json
  echo 'Published the latest blog list through Pukbot.'
fi
