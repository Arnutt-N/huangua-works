#!/usr/bin/env python3
"""Never ship a native `<select>`.

The native control draws its own chevron, and that glyph sits pressed against
the control's edge with no breathing room. Use the custom Listbox / Combobox pattern.
Radix UI Custom `<Select>` (@radix-ui/react-select) is an accessible ARIA listbox
and is exempted from this gate.

A deliberate exception is written with: `ds-allow-native-select` in a comment.

Usage:
  python3 scripts/lint_native_select.py <file|dir> [...]
Exit 0 = clean; 1 = a finding; 2 = unusable input.
"""
import re
import sys
from pathlib import Path

MARKUP_EXT = {".html", ".htm", ".tsx", ".jsx", ".vue", ".svelte", ".astro"}
SKIP_DIRS = {"node_modules", ".git", "dist", "__pycache__", ".ds-receipts"}

NATIVE_SELECT_LOWER = re.compile(r"<select\b")
NATIVE_SELECT_ANY = re.compile(r"<select\b", re.I)
RADIX_IMPORT = re.compile(r"['\"]@radix-ui/react-select['\"]|['\"]@/components/ui/select['\"]")
ALLOW_SELECT = "ds-allow-native-select"


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
    """Blank out comment bodies, keeping line numbers intact."""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    text = re.sub(r"<!--.*?-->", blank, text, flags=re.S)
    text = re.sub(r"/\*.*?\*/", blank, text, flags=re.S)
    text = re.sub(r"(?m)//[^\n]*", blank, text)
    return text


def allowed(lines, idx):
    """The exception may sit on the line itself or the line above it."""
    for n in (idx, idx - 1):
        if 0 <= n < len(lines) and ALLOW_SELECT in lines[n]:
            return True
    return False


def main(argv):
    paths = [a for a in argv if not a.startswith("-")]
    if not paths:
        print("ERROR: give at least one file or directory to scan.")
        return 2
    missing = [p for p in paths if not Path(p).exists()]
    if missing:
        print("ERROR: path(s) not found: " + ", ".join(missing))
        return 2

    files = list(iter_files(paths))
    if not files:
        print(f"ERROR: no scannable markup under {', '.join(paths)}")
        return 2

    found, unreadable = [], []
    for f in files:
        try:
            raw = f.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as err:
            unreadable.append((f, err))
            continue
        lines = raw.splitlines()
        code = strip_comments(raw).splitlines()
        is_jsx = f.suffix in {".tsx", ".jsx"}
        has_radix_import = bool(RADIX_IMPORT.search(raw))

        for i, line in enumerate(code):
            is_native = False
            if is_jsx:
                # Lowercase <select is native HTML. Uppercase <Select is custom React component (Radix UI)
                if NATIVE_SELECT_LOWER.search(line):
                    is_native = True
                elif NATIVE_SELECT_ANY.search(line) and not has_radix_import and not re.search(r"<Select\b", line):
                    is_native = True
            else:
                if NATIVE_SELECT_ANY.search(line):
                    is_native = True

            if is_native and not allowed(lines, i):
                found.append((f, i + 1, lines[i].strip()[:90]))

    print(f"Scanned {len(files) - len(unreadable)} of {len(files)} file(s).")

    for f, err in unreadable:
        print(f"ERROR: could not read {f}: {err}", file=sys.stderr)
    if unreadable:
        print(f"FAIL: {len(unreadable)} file(s) could not be read, so this run cannot report clean.")
        return 1

    if found:
        print(f"\nFAIL: {len(found)} native <select> element(s). The native control draws its own")
        print("chevron hard against the edge and cannot be made to match the system.")
        for f, n, line in found:
            print(f"  x {f}:{n}: {line}")
        print("\nUse SelectField from @/components/ui/select. The browser chevron cannot take that inset.")
        print(f"Add a `{ALLOW_SELECT}` comment on the line only when a native select is deliberate.")
        return 1

    print("OK: no native <select> in generated UI.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
