#!/usr/bin/env bash
# בונה ופורס ל-GitHub Pages (ענף gh-pages). משתני VITE_* נלקחים מ-.env
set -euo pipefail
cd "$(dirname "$0")/.."
BASE_PATH=/Garda/ npm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
TMP=$(mktemp -d)
cp -r dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages:gh-pages
echo "✓ פורס: https://elroitouati.github.io/Garda/"
