#!/usr/bin/env python3
"""Gate tests for lint_truncated_title: exact title attribute and usable roots."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("lint_truncated_title", ROOT / "lint_truncated_title.py")
lint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lint)


class ClipTitleGateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def write(self, name, body):
        path = self.dir / name
        path.write_text(body, encoding="utf-8")
        return path

    def test_missing_title_fails(self):
        path = self.write("no-title.tsx", '<span className="truncate">ข้อความยาว</span>')
        self.assertEqual(lint.main(["lint", str(path)]), 1)

    def test_data_title_only_fails(self):
        path = self.write("data-title.tsx", '<span className="truncate" data-title="ข้อความยาว">x</span>')
        self.assertEqual(lint.main(["lint", str(path)]), 1)

    def test_real_title_passes(self):
        path = self.write("title.tsx", '<span className="truncate" title="ข้อความยาว">x</span>')
        self.assertEqual(lint.main(["lint", str(path)]), 0)

    def test_nonexistent_root_fails(self):
        self.assertEqual(lint.main(["lint", str(self.dir / "missing")]), 2)

    def test_empty_directory_fails(self):
        self.assertEqual(lint.main(["lint", str(self.dir)]), 2)


if __name__ == "__main__":
    unittest.main()
