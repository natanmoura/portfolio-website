#!/usr/bin/env bash
# Turns every animated GIF the project pages use into a looping H.264 MP4
# plus a first-frame JPG poster, next to the GIF, and writes js/gif-sizes.js
# listing the converted ones with their sizes. main.js shows a GIF as video
# only when it is listed there, so a GIF that isn't converted still works.
# The MP4s are about a twentieth the size of the GIFs.
#
#   bash tools/gif-to-mp4.sh          only converts GIFs with no MP4 yet
#   bash tools/gif-to-mp4.sh --all    redoes every one
set -e
cd "$(dirname "$0")/.."
ALL=$1

gifs=$(grep -oE '"[^"]+\.gif"' js/projects.js | tr -d '"' | sort -u)

convert() {
  f=$1; out=${f%.gif}.mp4; poster=${f%.gif}.jpg
  [ -f "$f" ] || { echo "missing $f" >&2; return; }
  if [ "$ALL" = "--all" ] || [ ! -f "$out" ] || [ "$f" -nt "$out" ]; then
    ffmpeg -v error -y -i "$f" -movflags +faststart -pix_fmt yuv420p \
      -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -crf 14 -preset slow -an "$out"
    ffmpeg -v error -y -i "$f" -frames:v 1 -q:v 3 "$poster"
    echo "$(du -k "$f" | cut -f1)K -> $(du -k "$out" | cut -f1)K  $f"
  fi
}
export -f convert; export ALL

frames() { ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$1"; }

# Single-frame GIFs are stills: left as images.
todo=""
for f in $gifs; do [ -f "$f" ] && [ "$(frames "$f")" -gt 1 ] && todo="$todo $f"; done
printf '%s\n' $todo | xargs -P 4 -I{} bash -c 'convert "$@"' _ {}

{
  echo '// Written by tools/gif-to-mp4.sh. GIFs that have an MP4 version, with'
  echo '// their width and height. Do not edit by hand.'
  echo 'window.GIF_SIZES = {'
  for f in $todo; do
    out=${f%.gif}.mp4
    [ -f "$out" ] || continue
    wh=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$out")
    echo "  \"$f\": [$wh],"
  done
  echo '};'
} > js/gif-sizes.js
echo "wrote js/gif-sizes.js"
