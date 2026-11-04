#!/usr/bin/env python3
"""Fetch the pinned public source closure required for local development."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main():
    lock = json.loads((ROOT / "upstream-lock.json").read_text())
    destination = ROOT / ".upstream" / "dts02"

    def download(item):
        name, sha = item
        url = ("https://raw.githubusercontent.com/aeyakovenko/dts02-6502-signer/"
               + lock["commit"] + "/" + name)
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != sha:
            raise RuntimeError("Pinned source checksum mismatch: " + name)
        return name, data

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        sources = list(pool.map(download, lock["files"].items()))
    # Check the entire download before replacing any existing source file.
    for name, data in sources:
        path = destination / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print(str(len(sources)) + " pinned source files ready at " + str(destination))


if __name__ == "__main__":
    main()
