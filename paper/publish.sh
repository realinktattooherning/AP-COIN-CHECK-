#!/usr/bin/env bash
# Publish files to the paper-data branch without dropping the other bot's files:
# take the branch's latest state, put our files on top, replace the branch with one commit.
# usage: paper/publish.sh <message> <file>...
set -euo pipefail
msg="$1"; shift
url="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
tmp=$(mktemp -d)
git clone -q --depth 1 --branch paper-data "$url" "$tmp" 2>/dev/null || mkdir -p "$tmp"
for f in "$@"; do cp "$f" "$tmp/"; done
cd "$tmp"
rm -rf .git
git init -q -b paper-data
git config user.name "dk-paper-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -qm "$msg $(date -u +%FT%TZ)"
# this branch only holds the latest data (the one allowed force-push, by the bot only)
git push -qf "$url" HEAD:paper-data
