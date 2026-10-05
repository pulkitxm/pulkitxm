#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source_sha=${SOURCE_SHA:?SOURCE_SHA must identify the build commit}
pdf=built-resume/resume.pdf
test -s "$pdf"

git fetch --quiet origin main
if ! git diff --quiet "$source_sha" origin/main -- \
  resume/resume.tex resume/Dockerfile resume/Makefile \
  scripts/publish-resume.sh .github/workflows/resume.yml; then
  echo 'A newer resume build is pending; skipping this outdated PDF.'
  exit 0
fi

publish() {
  local directory=$1 repository=$2 path=$3
  cp "$pdf" "$directory/$path"
  (
    cd "$directory"
    git add -- "$path"
    if git diff --cached --quiet -- "$path"; then
      echo "$repository already has this PDF."
    else
      pukbot commit create --repo "$repository" --branch main \
        --message "Update resume PDF from $source_sha" "$path" --json
    fi
  )
}

publish . pulkitxm/pulkitxm resume/resume.pdf
publish website pulkitxm/pulkit.page apps/page/assets/content/resume.pdf

expected=$(git hash-object "$pdf")
for file in \
  pulkitxm/pulkitxm/contents/resume/resume.pdf \
  pulkitxm/pulkit.page/contents/apps/page/assets/content/resume.pdf; do
  actual=$(gh api "repos/$file?ref=main" --jq .sha)
  if [ "$actual" != "$expected" ]; then
    echo "Published PDF verification failed: $file" >&2
    exit 1
  fi
done

echo 'Both repositories contain the same validated resume PDF.'
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  printf 'Both resume PDFs match. Blob: %s.\n' "$expected" >> "$GITHUB_STEP_SUMMARY"
fi
