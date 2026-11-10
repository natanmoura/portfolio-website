#!/usr/bin/env bash
# Render every emoji SVG in assets/emoji/ to a 144px transparent PNG in
# assets/emoji/png/, which is what the site actually shows (see the note at
# the top of js/emoji-fluent.js for why). Uses headless Microsoft Edge, which
# draws the Fluent SVG filters correctly. Skips PNGs that already exist;
# pass --all to redo them.
#
#   bash tools/emoji-png.sh
set -u
SIZE=144
ROOT="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
# In Windows form, so Edge can open the page written there.
TMP="$(cygpath -m "$(mktemp -d)")"
mkdir -p "$ROOT/assets/emoji/png"

cat > "$TMP/render.html" <<EOF
<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block;width:${SIZE}px;height:${SIZE}px}</style></head>
<body><script>document.write('<img src="file:///$ROOT/assets/emoji/' + location.search.slice(1) + '.svg">')</script></body></html>
EOF

for svg in "$ROOT"/assets/emoji/*.svg; do
  name="$(basename "$svg" .svg)"
  out="$ROOT/assets/emoji/png/$name.png"
  if [ "${1:-}" != "--all" ] && [ -s "$out" ]; then continue; fi
  # A separate profile each time: back-to-back launches on one profile hand
  # off to the instance still running and exit without a screenshot.
  timeout 40 "$EDGE" --headless --hide-scrollbars --default-background-color=00000000 \
    --user-data-dir="$TMP/profile-$name" --window-size=$SIZE,$SIZE \
    --screenshot="$out" "file:///$TMP/render.html?$name" >/dev/null 2>&1
  # Edge can return before the file is written. Give it a moment.
  for _ in $(seq 1 50); do [ -s "$out" ] && break; sleep 0.2; done
  if [ -s "$out" ]; then echo "rendered $name"; else echo "FAILED $name"; fi
done
# Edge holds its profile files open for a moment after it exits.
sleep 2
rm -rf "$TMP" 2>/dev/null || true
