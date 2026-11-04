#!/usr/bin/env python3
"""Fail if any emoji or decorative pictograph appears in UI output.

The kit forbids emoji in product UI. This script enforces that rule so it
cannot drift back into the codebase.

Usage:
  python3 scripts/check_no_emoji.py path/to/src ...
Exit 0 = clean, 1 = an emoji/pictograph was found.
"""
import re
import sys
from pathlib import Path

EXTS = {".md", ".mdx", ".html", ".htm", ".tsx", ".jsx", ".ts", ".js",
        ".vue", ".svelte", ".css", ".scss", ".astro", ".json"}

# Emoji and dingbat pictographs (check marks, stars, etc.). Deliberately EXCLUDES
# arrows (U+2190-21FF) and box-drawing, which are legitimate typographic notation.
# Ranges are referenced by codepoint only.
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF"   # symbols and pictographs, emoticons, transport
    "\U00002600-\U000026FF"    # misc symbols
    "\U00002700-\U000027BF"    # dingbats (check marks, stars, scissors)
    "\U00002B00-\U00002BFF"    # misc symbols and arrow pictographs
    "\U0001FA70-\U0001FAFF"
    "\U0000FE0F\U000020E3]"    # variation selector and combining keycap
)

UI_EXTS = {".html", ".htm", ".tsx", ".jsx", ".vue", ".svelte"}
DASH = re.compile("[\u2014\u2013]")  # em-dash and en-dash: AI-pattern tell in UI copy


def iter_files(paths):
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            for f in pp.rglob("*"):
                if f.suffix in EXTS and "node_modules" not in f.parts and not f.is_dir():
                    yield f
        elif pp.is_file() and pp.suffix in EXTS:
            yield pp


def main(argv):
    explicit = [Path(a) for a in argv]
    if not explicit:
        print("ERROR: give at least one file or directory to scan.")
        return 1

    missing = [p for p in explicit if not p.exists()]
    if missing:
        print("ERROR: path(s) not found: " + ", ".join(str(m) for m in missing))
        return 1

    hits = []
    files = list(iter_files(explicit))
    if not files:
        print(f"ERROR: no scannable file(s) under {', '.join(str(p) for p in explicit)}")
        return 1

    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        ui = f.suffix in UI_EXTS
        for n, line in enumerate(text.splitlines(), 1):
            for m in EMOJI.finditer(line):
                hits.append(f"{f}:{n}: emoji/pictograph {m.group(0)!r} - use lucide or plain text")
            if ui:
                for m in DASH.finditer(line):
                    hits.append(f"{f}:{n}: em/en-dash {m.group(0)!r} - AI-pattern tell; use period, comma, or hyphen")

    print(f"Scanned {len(files)} file(s).")
    if hits:
        print(f"\nFAIL: {len(hits)} emoji/pictograph(s) found:")
        for h in hits:
            print("  x " + h)
        return 1
    print("OK: no emoji in UI output.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
