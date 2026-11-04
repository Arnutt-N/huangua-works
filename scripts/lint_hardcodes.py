#!/usr/bin/env python3
"""Lint generated component code for hardcoded values that should be design tokens.

The kit rule is "zero hardcoded values" - every color/size/radius/duration must come
from a token (CSS var, theme key, asset). Point this at YOUR component source.

Usage:
  python3 scripts/lint_hardcodes.py src/components            # a dir
  python3 scripts/lint_hardcodes.py Button.tsx Card.vue       # files
  python3 scripts/lint_hardcodes.py --ext .tsx,.vue src/

Flags a line with a raw hex color, px length, or ms/s duration UNLESS it:
  - is inside a CSS var / token reference (var(--...), {token...}, theme(...)),
  - is a token-definition file (tokens/*.json),
  - carries an inline allow comment containing 'ds-allow-hardcode'.
Exit 0 = clean, 1 = violations found.
"""
import re
import sys
from pathlib import Path

CODE_EXT = {".css", ".scss", ".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte",
            ".swift", ".kt", ".dart", ".html"}

HEX = re.compile(r"(?<![\w&])#[0-9a-fA-F]{3,8}\b")
# Outside CSS, a # is far more often prose than a colour: "issue #412" is not a
# hex. In markup a hex only counts in value position - after a colon, an equals,
# an opening paren or a comma.
HEX_VALUE = re.compile(r"[:=(,]\s*[\"']?#[0-9a-fA-F]{3,8}\b")
PX = re.compile(r"(?<![\w.])\d+(?:\.\d+)?px\b")
MS = re.compile(r"(?<![\w.])\d+(?:\.\d+)?m?s\b")
# raw Tailwind palette utilities (bg-gray-500, text-blue-600, border-red-400 ...) that
# bypass semantic tokens - the #1 real-world drift.
_TW_PREFIX = r"(?:bg|text|border|ring|ring-offset|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|placeholder|shadow)"
_TW_COLOR = r"(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)"
TW = re.compile(rf"(?<![\w-]){_TW_PREFIX}-{_TW_COLOR}-(?:50|100|200|300|400|500|600|700|800|900|950)\b")
# hardcoded font-family not coming from a token/var
FONT = re.compile(r"font-family\s*:\s*(?!.*var\()")
# A custom-property definition line, where a raw value is the point.
TOKEN_DEF = re.compile(r"--[\w\-]+\s*:")
# Other token syntaxes that still exempt a whole line: a theme() call, a
# tokens.foo path, a {token.reference}.
THEME_FN = re.compile(r"theme\(|tokens?[./]|\{[\w.\-]+\}")
ALLOW = "ds-allow-hardcode"
# px values that are conventionally fine (hairlines, zero, 1px borders)
PX_OK = {"0px", "1px"}


def iter_files(paths, exts):
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            for f in pp.rglob("*"):
                if f.suffix in exts and "node_modules" not in f.parts and not f.is_dir():
                    yield f
        elif pp.is_file() and pp.suffix in exts:
            yield pp


def strip_block_comment(line, in_comment):
    """Return (code outside /* */, whether the comment is still open)."""
    out, i = [], 0
    while i < len(line):
        if in_comment:
            end = line.find("*/", i)
            if end == -1:
                return "".join(out), True
            i, in_comment = end + 2, False
        else:
            start = line.find("/*", i)
            if start == -1:
                out.append(line[i:])
                return "".join(out), False
            out.append(line[i:start])
            i, in_comment = start + 2, True
    return "".join(out), in_comment


def mask_var_refs(line):
    """Blank out every `var(...)` span, nesting and fallbacks included."""
    out, i = [], 0
    while True:
        j = line.find("var(", i)
        if j < 0:
            out.append(line[i:])
            return "".join(out)
        out.append(line[i:j])
        depth, k = 0, j + 3
        while k < len(line):
            if line[k] == "(":
                depth += 1
            elif line[k] == ")":
                depth -= 1
                if depth == 0:
                    break
            k += 1
        i = k + 1


def lint_line(line, tailwind=True, css_scope=True):
    """css_scope=False means the line is markup or prose, not CSS."""
    if ALLOW in line:
        return []
    if TOKEN_DEF.search(line):
        return []
    if THEME_FN.search(line):
        return []
    code = mask_var_refs(line)
    stripped = line.strip()
    if stripped.startswith(("//", "*", "/*", "#", "<!--")):
        return []
    hits = []
    media_cond = "@media" in line or "@container" in line
    for m in (HEX if css_scope else HEX_VALUE).finditer(code):
        hits.append(("hex", m.group(0).lstrip(":=(, \"'")))
    if not media_cond and css_scope:
        for m in PX.finditer(code):
            if m.group(0) not in PX_OK:
                hits.append(("px", m.group(0)))
        for m in MS.finditer(code):
            hits.append(("time", m.group(0)))
    if tailwind:
        for m in TW.finditer(line):
            hits.append(("tailwind-palette", m.group(0)))
    if FONT.search(line):
        hits.append(("font-family", "literal font-family"))
    return hits


def main(argv):
    exts = CODE_EXT
    tailwind = True
    args = []
    i = 0
    while i < len(argv):
        if argv[i] == "--ext" and i + 1 < len(argv):
            exts = {e if e.startswith(".") else "." + e for e in argv[i + 1].split(",")}
            i += 2
        elif argv[i] in ("--no-tw", "--no-tailwind"):
            tailwind = False
            i += 1
        else:
            args.append(argv[i])
            i += 1
    if not args:
        print(__doc__)
        return 0

    missing = [a for a in args if not Path(a).exists()]
    if missing:
        print("ERROR: path(s) not found: " + ", ".join(missing))
        return 1

    files = list(iter_files(args, exts))
    if not files:
        print(f"ERROR: no lintable file(s) under {', '.join(args)}")
        return 1
    violations = 0
    unreadable = []
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError) as err:
            unreadable.append((f, err))
            continue
        in_allow = False
        markup = f.suffix.lower() in {".html", ".htm", ".vue", ".svelte", ".astro"}
        in_style = False
        in_comment = False
        for n, raw in enumerate(text.splitlines(), 1):
            if "ds-allow-hardcode:start" in raw:
                in_allow = True
                continue
            if "ds-allow-hardcode:end" in raw:
                in_allow = False
                continue
            if in_allow or ALLOW in raw:
                continue
            if markup:
                low = raw.lower()
                opens = "<style" in low
                closes = "</style>" in low
                css_here = in_style or opens or "style=" in low
                if opens and not closes:
                    in_style = True
                if closes:
                    in_style = False
            else:
                css_here = True
            if css_here:
                line, in_comment = strip_block_comment(raw, in_comment)
            else:
                line, in_comment = raw, False
            for kind, val in lint_line(line, tailwind, css_here):
                print(f"{f}:{n}: hardcoded {kind} '{val}' - use a token")
                violations += 1

    print(f"\nScanned {len(files) - len(unreadable)} of {len(files)} candidate file(s).")
    for f, err in unreadable:
        print(f"ERROR: could not read {f}: {err}", file=sys.stderr)
    if unreadable:
        print(f"FAIL: {len(unreadable)} file(s) could not be read, so this run "
              f"cannot report clean. {violations} hardcoded value(s) in the rest.")
        return 1
    if violations:
        print(f"FAIL: {violations} hardcoded value(s). Map each to a token, "
              f"or add a '{ALLOW}' comment for a justified exception.")
        return 1
    print("OK: no hardcoded values found.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
