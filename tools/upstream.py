"""Verify the full pinned source closure before import and rebuild the C emulator."""
from contextlib import contextmanager
import hashlib
import importlib
import json
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_pinned(directory, expected_commit):
    directory = pathlib.Path(directory).resolve()
    pins = json.loads((ROOT / "upstream-lock.json").read_text())
    if pins["commit"] != expected_commit:
        raise ValueError("Incorrect source lock")
    for name, digest in pins["files"].items():
        path = directory / name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError("Upstream source mismatch: " + name)
    # A previous import from another checkout must not silently bypass these pins.
    for name, module in list(sys.modules.items()):
        if name == "sim" or name.startswith("sim."):
            actual = getattr(module, "__file__", None)
            if actual is None or pathlib.Path(actual).resolve().parent != directory / "sim":
                raise ValueError("Conflicting upstream module already imported: " + name)
    sys.path.insert(0, str(directory))
    try:
        return {name: importlib.import_module("sim." + name)
                for name in ("signer_fw", "signer_harness", "solana", "emu", "asm", "cpu65c02")}
    finally:
        sys.path.remove(str(directory))


@contextmanager
def isolated_emulator(emu):
    previous = emu.BUILD, emu.LIB, emu._lib
    with tempfile.TemporaryDirectory(prefix="dts-emulator-") as directory:
        emu.BUILD = directory
        emu.LIB = str(pathlib.Path(directory) / "_emu65.so")
        emu._lib = None
        try:
            yield
        finally:
            emu.BUILD, emu.LIB, emu._lib = previous
