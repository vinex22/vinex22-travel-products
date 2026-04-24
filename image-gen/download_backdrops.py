"""Download Unsplash backdrops listed in backdrops.json into web/public/backdrops/.

Usage:
    python download_backdrops.py            # download any slot with a non-empty url
    python download_backdrops.py --force    # re-download even if file exists
    python download_backdrops.py --slot hero-mountains   # one slot only

Notes:
  - Accepts Unsplash photo PAGE urls (https://unsplash.com/photos/<slug>-<id>)
    or direct image urls (images.unsplash.com/...).
  - Saves attribution to web/public/backdrops/CREDITS.md.
  - Uses the public Unsplash CDN (no API key); requests a reasonable max width.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

SCRIPT_DIR = Path(__file__).resolve().parent
MANIFEST = SCRIPT_DIR / "backdrops.json"
OUT_DIR = SCRIPT_DIR.parent / "web" / "public" / "backdrops"
CREDITS = OUT_DIR / "CREDITS.md"

UA = "Mozilla/5.0 (vinex22-travels backdrop fetcher)"
MAX_W = 2880  # 2x for retina parallax


def normalize_url(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    # Already a direct image url
    if "images.unsplash.com" in raw:
        # Force a sane size + format
        sep = "&" if "?" in raw else "?"
        if "w=" not in raw:
            raw = f"{raw}{sep}w={MAX_W}&q=85&fm=jpg&fit=max"
        return raw
    # Photo page url -> extract id (last 11 chars after final hyphen typically)
    m = re.search(r"unsplash\.com/photos/(?:[^/]+-)?([A-Za-z0-9_-]{11})", raw)
    if m:
        pid = m.group(1)
        return f"https://images.unsplash.com/photo-{pid}?w={MAX_W}&q=85&fm=jpg&fit=max"
    # Some unsplash photo ids look like photo-1234567890123-abc
    m = re.search(r"unsplash\.com/photos/([A-Za-z0-9_-]+)", raw)
    if m:
        pid = m.group(1).split("-")[-1]
        return f"https://images.unsplash.com/photo-{pid}?w={MAX_W}&q=85&fm=jpg&fit=max"
    # Fallback: pass through (user may have given a download endpoint)
    return raw


def fetch(url: str, dest: Path) -> int:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        data = r.read()
        f.write(data)
        return len(data)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--slot", help="Only fetch this one slot")
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows: list[str] = ["# Backdrop credits", "", "All photos via [Unsplash](https://unsplash.com) under the Unsplash License.", ""]
    ok = skipped = failed = empty = 0

    for entry in manifest["backdrops"]:
        slot = entry["slot"]
        if args.slot and slot != args.slot:
            continue
        url = entry.get("url", "").strip()
        credit = entry.get("credit", "").strip()
        dest = OUT_DIR / f"{slot}.jpg"

        if not url:
            print(f"[SKIP] {slot}: no url provided")
            empty += 1
            continue

        if dest.exists() and not args.force:
            print(f"[SKIP] {slot}: {dest.name} exists")
            skipped += 1
            if credit:
                rows.append(f"- **{slot}** \u2014 {credit}")
            continue

        norm = normalize_url(url)
        try:
            size = fetch(norm, dest)
            print(f"[OK]   {slot}: {dest.name} ({size/1024:.0f} KB)")
            ok += 1
            if credit:
                rows.append(f"- **{slot}** \u2014 {credit}")
            else:
                rows.append(f"- **{slot}** \u2014 source: {url}")
        except Exception as e:
            print(f"[FAIL] {slot}: {e}")
            failed += 1

    CREDITS.write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(f"\nDone. ok={ok} skipped={skipped} empty={empty} failed={failed}")
    print(f"Credits: {CREDITS}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
