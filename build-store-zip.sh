#!/bin/bash
# Builds a Chrome Web Store zip with the "key" field stripped from manifest.json.
# The repo's manifest.json keeps the key for stable unpacked installs.

set -e

OUTFILE="${1:-../meet-watchdog-store.zip}"

# Create a temp directory
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Copy everything except git, dev files, and store-assets
rsync -a \
  --exclude='.git' \
  --exclude='*.pem' \
  --exclude='*.swp' \
  --exclude='.*.swp' \
  --exclude='.claude' \
  --exclude='store-assets' \
  --exclude='build-store-zip.sh' \
  . "$TMPDIR/"

# Strip the key field from manifest.json
python3 -c "
import json, sys
with open('$TMPDIR/manifest.json') as f:
    m = json.load(f)
m.pop('key', None)
with open('$TMPDIR/manifest.json', 'w') as f:
    json.dump(m, f, indent=2)
print('key field removed from store manifest')
"

# Zip it
rm -f "$OUTFILE"
(cd "$TMPDIR" && zip -r "$(cd "$(dirname "$OUTFILE")" && pwd)/$(basename "$OUTFILE")" .)

echo "Store zip ready: $OUTFILE ($(du -sh "$OUTFILE" | cut -f1))"
