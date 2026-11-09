#!/usr/bin/env python3
"""Truncated text must expose the full string on hover.

A class of `truncate` or `line-clamp-*` hides the rest of the label.
The same opening tag must set `title` so a pointer hover shows the full text.

A deliberate exception is written with `ds-allow-clip` on that tag.

Usage:
  python3 scripts/lint_truncated_title.py <file|dir> [...]
Exit 0 = clean; 1 = a finding; 2 = unusable input.
"""
import re
import sys
from pathlib import Path

CLASS_CLIP = re.compile(r"""['"`][^'"`]*\b(?:truncate|line-clamp-\d+)\b[^'"`]*['"`]""")

MARKUP_EXT = {".tsx", ".jsx"}
SKIP_DIRS = {"node_modules", ".git", "dist", "__pycache__"}
ALLOW = "ds-allow-clip"


def iter_files(paths):
    for raw in paths:
        p = Path(raw)
        if p.is_file():
            yield p
        elif p.is_dir():
            for f in sorted(p.rglob("*")):
                if f.is_file() and f.suffix in MARKUP_EXT and not (set(f.parts) & SKIP_DIRS):
                    yield f


def strip_comments(text):
    out = []
    i = 0
    n = len(text)
    while i < n:
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            end = n if end < 0 else end + 2
            out.append(" " * (end - i))
            i = end
            continue
        if text.startswith("//", i):
            end = text.find("\n", i)
            end = n if end < 0 else end
            out.append(" " * (end - i))
            i = end
            continue
        out.append(text[i])
        i += 1
    return "".join(out)


def opening_tags(text):
    i = 0
    n = len(text)
    while i < n:
        if text[i] == "<" and i + 1 < n and (text[i + 1].isalpha() or text[i + 1] in "_"):
            start = i
            i += 1
            brace = 0
            quote = None
            while i < n:
                c = text[i]
                if quote:
                    if c == "\\":
                        i += 2
                        continue
                    if c == quote:
                        quote = None
                    i += 1
                    continue
                if c in "\"'`":
                    quote = c
                elif c == "{":
                    brace += 1
                elif c == "}":
                    brace = max(0, brace - 1)
                elif c == ">" and brace == 0:
                    yield start, text[start : i + 1]
                    break
                i += 1
        i += 1


def main(argv):
    if len(argv) < 2:
        print("usage: lint_truncated_title.py <file|dir> [...]", file=sys.stderr)
        return 2
    findings = 0
    for path in iter_files(argv[1:]):
        raw = path.read_text(encoding="utf-8")
        text = strip_comments(raw)
        for start, tag in opening_tags(text):
            if ALLOW in tag:
                continue
            if not CLASS_CLIP.search(tag):
                continue
            if "title=" in tag:
                continue
            line = text.count("\n", 0, start) + 1
            print(f"{path}:{line}: truncated text needs title= so hover shows the full string")
            findings += 1
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
