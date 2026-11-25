#!/usr/bin/env bash
# Regenerates the subset Carlito fonts in public/fonts.
#
# Carlito is licensed under the SIL Open Font License 1.1 (see
# public/fonts/Carlito-OFL.txt). The letter preview uses the same files as the
# PDF export, so both share Calibri's advance widths.
#
# Requirements: fonttools with brotli is not needed (TTF output, no hinting).
#   python3 -m pip install fonttools
set -euo pipefail

cd "$(dirname "$0")/.."

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

base_url="https://raw.githubusercontent.com/google/fonts/main/ofl/carlito"
curl -fsSL -o "$workdir/Carlito-Regular.ttf" "$base_url/Carlito-Regular.ttf"
curl -fsSL -o "$workdir/Carlito-Bold.ttf" "$base_url/Carlito-Bold.ttf"
curl -fsSL -o "public/fonts/Carlito-OFL.txt" "$base_url/OFL.txt"

# Latin-1 + Latin Extended-A, typographic punctuation, currency, arrows.
unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2027,U+2030-205E,U+20AC,U+2116,U+2122,U+2190-2193"
features="kern,liga,ccmp,mark,mkmk"

for weight in Regular Bold; do
  pyftsubset "$workdir/Carlito-$weight.ttf" \
    --output-file="public/fonts/Carlito-$weight.ttf" \
    --unicodes="$unicodes" \
    --layout-features="$features" \
    --no-hinting
done

ls -l public/fonts/Carlito-*.ttf
