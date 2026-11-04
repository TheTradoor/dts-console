"""Adversarial checks at the independently implemented Python boundary."""
import copy
import json
import pathlib
import tempfile
import unittest
from unittest import mock
from types import SimpleNamespace
import sys
from tools.sign_fixture import parse_message, sign, validate
from tools.sign_fixture import UPSTREAM
from tools.upstream import load_pinned
import os

ROOT = pathlib.Path(__file__).resolve().parents[1]
FIXTURES = [json.loads((ROOT / "dist" / (name + "-session.json")).read_text())
            for name in ("fixture", "nonce-fixture")]


class BridgeTests(unittest.TestCase):
    def test_both_canonical_packets(self):
        for packet in FIXTURES:
            with self.subTest(kind=packet["review"]["kind"]):
                message, envelope = validate(packet)
                self.assertEqual(message.hex(), packet["messageHex"])
                self.assertEqual(envelope.hex(), packet["envelopeHex"])

    def test_profile_is_numeric_zero_not_a_boolean_or_coerced_string(self):
        for value in (False, True, "0", None, 1, [], {}):
            with self.subTest(profile=value):
                packet = copy.deepcopy(FIXTURES[0])
                packet["profile"] = value
                with self.assertRaises(ValueError):
                    validate(packet)
        # JSON numeric zero has the same meaning as in the JavaScript parser.
        packet = copy.deepcopy(FIXTURES[0])
        packet["profile"] = 0.0
        validate(packet)

    def test_every_truncated_prefix_is_rejected(self):
        for packet in FIXTURES:
            message = bytes.fromhex(packet["messageHex"])
            for length in range(len(message)):
                with self.subTest(kind=packet["review"]["kind"], length=length):
                    with self.assertRaises(ValueError):
                        parse_message(message[:length])

    def test_independent_permission_and_nonce_rejections(self):
        for packet, offsets in ((FIXTURES[0], (0, 1, 2, 99, 138)),
                                (FIXTURES[1], (0, 1, 2, 100, 133, 198, 201, 203))):
            for offset in offsets:
                with self.subTest(kind=packet["review"]["kind"], offset=offset):
                    message = bytearray.fromhex(packet["messageHex"])
                    message[offset] ^= 1
                    with self.assertRaises(ValueError):
                        parse_message(bytes(message))

    def test_noncanonical_account_count_and_trailing_bytes(self):
        message = bytes.fromhex(FIXTURES[0]["messageHex"])
        for bad in (message[:3] + b"\x83\x00" + message[4:],
                    message[:3] + b"\xff\xff\x7f" + message[4:], message + b"\x00"):
            with self.assertRaises(ValueError):
                parse_message(bad)

    def test_hash_metadata_and_envelope_changes_are_rejected(self):
        for field in ("messageSha256", "messageSha512", "envelopeHex", "expectedPublicKeyHex",
                      "upstreamCommit", "network", "schema"):
            packet = copy.deepcopy(FIXTURES[0])
            packet[field] = "changed"
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate(packet)
        packet = copy.deepcopy(FIXTURES[0])
        packet["review"]["lamports"] = "1"
        with self.assertRaisesRegex(ValueError, "Review metadata"):
            validate(packet)

    def test_malformed_hex_does_not_reach_firmware(self):
        for value in (" ", "0", "GG", "00" * 1168, None, [], FIXTURES[0]["messageHex"].upper()):
            packet = copy.deepcopy(FIXTURES[0])
            packet["messageHex"] = value
            with self.subTest(value_type=type(value).__name__), self.assertRaises(ValueError):
                validate(packet)

    def test_source_mismatch_is_rejected_before_import_or_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "sim"
            path.mkdir()
            (path / "__init__.py").write_text("raise RuntimeError('must not execute')\n")
            with self.assertRaisesRegex(ValueError, "Upstream source mismatch"):
                sign(FIXTURES[0], directory)

    def test_a_cached_module_from_another_checkout_is_rejected(self):
        directory = os.environ.get("DTS_UPSTREAM", ROOT / ".upstream/dts02")
        with mock.patch.dict(sys.modules, {"sim": SimpleNamespace(__file__="/different/sim/__init__.py")}):
            with self.assertRaisesRegex(ValueError, "Conflicting upstream module"):
                load_pinned(directory, UPSTREAM)


if __name__ == "__main__":
    unittest.main()
