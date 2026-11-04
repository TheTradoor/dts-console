#!/usr/bin/env python3
"""Reproduce the tests and actual-firmware fixtures without replacing references."""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


def run(args, env=None, timeout=180):
    completed = subprocess.run(args, cwd=ROOT, env=env, text=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               timeout=timeout)
    if completed.returncode:
        raise RuntimeError("Command failed: " + " ".join(map(str, args)) + "\n" + completed.stdout)
    return completed.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch-upstream", action="store_true")
    parser.add_argument("--upstream", type=pathlib.Path, default=ROOT / ".upstream" / "dts02")
    parser.add_argument("--report", type=pathlib.Path)
    args = parser.parse_args()
    upstream = args.upstream.resolve()
    if args.fetch_upstream:
        if upstream != (ROOT / ".upstream" / "dts02").resolve():
            parser.error("--fetch-upstream uses the default .upstream/dts02 location")
        print(run([sys.executable, "tools/fetch_upstream.py"]).strip(), flush=True)
    lock = json.loads((ROOT / "upstream-lock.json").read_text())
    for name, digest in lock["files"].items():
        path = upstream / name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise RuntimeError("Missing or changed upstream source: " + name)
    print("PASS: all pinned upstream source hashes", flush=True)
    versions = {
        "node": run(["node", "--version"]).strip(),
        "python": sys.version.split()[0],
        "cc": run(["cc", "--version"]).splitlines()[0],
        "openssl": run(["openssl", "version"]).strip(),
    }
    for name in ["app.mjs", "protocol.mjs", "crypto.mjs"]:
        run(["node", "--check", "dist/" + name])
    env = dict(os.environ, DTS_UPSTREAM=str(upstream))
    tap = run(["node", "--test", "--test-reporter=tap", "tests/protocol.test.mjs"], env=env)
    def count(label):
        match = re.search(r"^# " + label + r" (\d+)$", tap, re.M)
        if not match:
            raise RuntimeError("Missing test result count: " + label)
        return int(match.group(1))
    js = {label: count(label) for label in ["tests", "pass", "fail", "cancelled", "skipped", "todo"]}
    if js["fail"] or js["cancelled"] or js["skipped"] or js["todo"] or js["pass"] != js["tests"]:
        raise RuntimeError("Incomplete JavaScript test run")
    print("PASS: " + str(js["pass"]) + " JavaScript tests", flush=True)
    # unittest discovery reports the real count; do not hard-code a success total.
    sys.path.insert(0, str(ROOT))
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), pattern="test_*.py")
    python_result = unittest.TextTestRunner(verbosity=1).run(suite)
    if not python_result.wasSuccessful() or python_result.skipped or not python_result.testsRun:
        raise RuntimeError("Incomplete Python test run")
    print("PASS: " + str(python_result.testsRun) + " Python tests", flush=True)
    firmware = {}
    with tempfile.TemporaryDirectory(prefix="dts-reproduce-") as directory:
        for name in ["fixture", "nonce-fixture"]:
            output = pathlib.Path(directory) / (name + "-result.json")
            run([sys.executable, "tools/sign_fixture.py", "dist/" + name + "-session.json",
                 "--upstream", str(upstream), "--output", str(output)])
            actual = json.loads(output.read_text())
            expected = json.loads((ROOT / "dist" / (name + "-result.json")).read_text())
            if actual != expected:
                raise RuntimeError(name + ": fresh output differs from the checked-in reference")
            firmware[name] = actual["evidence"]
            firmware[name]["recordSha256"] = hashlib.sha256(bytes.fromhex(actual["recordHex"])).hexdigest()
            firmware[name]["sessionSha256"] = actual["sessionSha256"]
            print("PASS: " + name + " complete record and evidence reproduced (" +
                  str(actual["evidence"]["cycles"]) + " emulated cycles)", flush=True)
    report = {
        "schema": "dts-console-validation-v1",
        "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "local automated tests and emulator reproducibility; not an audit",
        "upstreamCommit": lock["commit"], "upstreamFileHashes": lock["files"],
        "tools": versions, "javascript": js,
        "python": {"tests": python_result.testsRun, "failed": 0, "skipped": 0},
        "passed": js["pass"] + python_result.testsRun, "failed": 0, "skipped": 0,
        "firmwareRuns": firmware, "hardwareMeasured": False, "onChainExecuted": False,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
        args.report.with_suffix(".tap").write_text(tap)
        print("Report: " + str(args.report))
    print("All checks passed. Reference fixture files were not overwritten.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print("Verification failed: " + str(error), file=sys.stderr)
        sys.exit(1)
