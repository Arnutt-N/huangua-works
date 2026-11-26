#!/usr/bin/env node
// § ใช้ TypeScript compiler เป็น parser — regex/substring บนข้อความ tag หลบด้วย data-title ได้
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const CLIP = /\b(?:truncate|line-clamp-\d+)\b/;
const EXT = new Set(['.tsx', '.jsx']);
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__']);
const args = process.argv.slice(2);

if (!args.length) {
  console.error('usage: lint_truncated_title.py <file|dir> [...]');
  process.exit(2);
}
const missing = args.filter((p) => {
  try {
    statSync(p);
    return false;
  } catch {
    return true;
  }
});
if (missing.length) {
  console.error(`ERROR: path(s) not found: ${missing.join(', ')}`);
  process.exit(2);
}

const files = [];
function walk(target) {
  if (statSync(target).isFile()) {
    if (EXT.has(path.extname(target))) files.push(target);
    return;
  }
  for (const entry of readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && !SKIP.has(entry.name)) walk(path.join(target, entry.name));
    if (entry.isFile() && EXT.has(path.extname(entry.name))) files.push(path.join(target, entry.name));
  }
}
args.forEach(walk);
if (!files.length) {
  console.error(`ERROR: no scannable markup under ${args.join(', ')}`);
  process.exit(2);
}

let findings = 0;
let unreadable = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`ERROR: could not read ${file}: ${err.message}`);
    unreadable++;
    continue;
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      const name = (attr) => attr.name.getText(source);
      const has = (wanted) => attrs.some((attr) => name(attr) === wanted);
      const className = attrs.find((attr) => name(attr) === 'className');
      const value = className?.initializer && ts.isStringLiteral(className.initializer) ? className.initializer.text : '';
      if (CLIP.test(value) && !has('ds-allow-clip') && !has('title')) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        console.log(`${file}:${line + 1}: truncated text needs title= so hover shows the full string`);
        findings++;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
console.log(`Scanned ${files.length - unreadable} of ${files.length} file(s).`);
if (unreadable) {
  console.error(`FAIL: ${unreadable} file(s) could not be read, so this run cannot report clean.`);
  process.exit(1);
}
process.exit(findings ? 1 : 0);
