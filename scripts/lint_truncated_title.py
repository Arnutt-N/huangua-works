#!/usr/bin/env python3
"""Truncated text must expose the full string on hover.

A class of `truncate` or `line-clamp-*` hides the rest of the label.
The same opening JSX tag must set an exact `title` attribute so a pointer
hover shows the full text. `ds-allow-clip` on that tag is a deliberate exception.

Usage:
  python3 scripts/lint_truncated_title.py <file|dir> [...]
Exit 0 = clean; 1 = a finding; 2 = unusable input.

§ ตรวจด้วย TypeScript AST (scripts/lint_truncated_title_ast.mjs) ไม่ใช่ substring —
`data-title` หรือคำว่า title ใน string value ต้องไม่ผ่าน gate นี้
"""
import os
import subprocess
import sys
from pathlib import Path

AST_CHECKER = Path(__file__).with_name("lint_truncated_title_ast.mjs")


def main(argv):
    paths = argv[1:]
    if not paths or any(not Path(p).exists() for p in paths):
        print("usage: lint_truncated_title.py <file|dir> [...]", file=sys.stderr)
        return 2
    node = os.environ.get("NODE", "node")
    return subprocess.run([node, str(AST_CHECKER), *paths], check=False).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv))
