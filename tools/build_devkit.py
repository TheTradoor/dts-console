#!/usr/bin/env python3
"""Build a deterministic source kit with explicit include roots and no DTS source."""
import argparse
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROOT_FILES = ("README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "NOTICE.md", "LICENSE",
              "package.json", "package-lock.json", "upstream-lock.json", ".gitignore")
DIRECTORIES = ("dist", "firmware", "tools", "tests", "docs", ".github")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "dist" / "dts-console-devkit.zip")
    args = parser.parse_args()
    output = args.output.resolve()
    files = [ROOT / name for name in ROOT_FILES]
    for name in DIRECTORIES:
        files.extend(p for p in (ROOT / name).rglob("*")
                     if p.is_file() and not p.is_symlink()
                     and p.suffix not in (".zip", ".pyc")
                     and "__pycache__" not in p.parts)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            if path.resolve() == output:
                continue
            info = zipfile.ZipInfo("dts-console/" + path.relative_to(ROOT).as_posix(),
                                   date_time=(2026, 11, 4, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    print(str(output) + ": " + str(output.stat().st_size) + " bytes")


if __name__ == "__main__":
    main()
