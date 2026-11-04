#!/usr/bin/env python3
"""Run pinned DTS-02 signing firmware with a published test seed.

This is a local emulator bridge, not a hardware signer. It never accepts a seed.
The host-side policy below is not an on-device authorization policy.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from tools.upstream import isolated_emulator, load_pinned
UPSTREAM = "a7cbac2ed7093a3cd994c4b7f1109396cd1d2faf"
SEED = bytes.fromhex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
PUBLIC = bytes.fromhex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a")
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def need(value, reason):
    if not value:
        raise ValueError(reason)


def b58(raw):
    n, s = int.from_bytes(raw, "big"), ""
    while n:
        n, r = divmod(n, 58)
        s = B58[r] + s
    return "1" * (len(raw) - len(raw.lstrip(b"\0"))) + s


def parse_message(message):
    """Independently decode the exact two supported canonical legacy layouts."""
    need(len(message) <= 1167, "Message exceeds the supported legacy limit")
    pos = 0

    def take(n):
        nonlocal pos
        need(pos + n <= len(message), "Truncated message")
        b = message[pos:pos+n]
        pos += n
        return b

    def compact():
        start = pos
        n = 0
        for i in range(3):
            b = take(1)[0]
            n += (b & 127) << (7*i)
            need(n <= 65535, "Compact-u16 overflow")
            if b < 128:
                x, encoded = n, bytearray()
                while True:
                    part = x & 127
                    x >>= 7
                    encoded.append(part | (128 if x else 0))
                    if not x:
                        break
                need(message[start:pos] == bytes(encoded), "Noncanonical compact-u16")
                return n
        raise ValueError("Invalid compact-u16")

    header = take(3)
    need(header[:2] == b"\x01\x00", "Unsupported signer layout")
    n = compact()
    need(n in (3, 5), "Unsupported account layout")
    keys = [take(32) for _ in range(n)]
    need(len(set(keys)) == n and keys[0] == PUBLIC, "Duplicate keys or non-test signer")
    blockhash = take(32)
    nonce = n == 5
    count = compact()
    need(count == (2 if nonce else 1), "Unsupported instruction count")
    instructions = []
    for _ in range(count):
        program = take(1)[0]
        length = compact()
        need(length <= 5, "Too many accounts")
        accounts = take(length)
        size = compact()
        need(size <= 12, "Unsupported instruction data")
        instructions.append((program, accounts, take(size)))
    need(pos == len(message), "Trailing bytes")
    need(header[2] == (2 if nonce else 1) and keys[-1] == bytes(32), "Invalid permissions or program")
    if nonce:
        need(b58(keys[3]) == "SysvarRecentB1ockHashes11111111111111111111", "Wrong nonce sysvar")
        need(instructions[0] == (4, b"\x01\x03\x00", b"\x04\0\0\0"), "Invalid nonce advance")
    program, accounts, data = instructions[-1]
    need(program == (4 if nonce else 2) and accounts == (b"\x00\x02" if nonce else b"\x00\x01")
         and len(data) == 12 and data[:4] == b"\x02\0\0\0", "Unsupported transfer")
    lamports = int.from_bytes(data[4:], "little")
    need(lamports > 0, "Zero amount")
    whole, fraction = divmod(lamports, 10**9)
    amount = str(whole) + (("." + str(fraction).zfill(9).rstrip("0")) if fraction else "")
    return dict(kind="durable-nonce-transfer" if nonce else "legacy-transfer",
                **{"from": b58(keys[0])}, recipient=b58(keys[2 if nonce else 1]),
                lamports=str(lamports), amountSol=amount, blockhash=b58(blockhash),
                nonceAccount=b58(keys[1]) if nonce else None, messageBytes=len(message))


def validate(packet):
    need(isinstance(packet, dict) and packet.get("schema") == "dts-console-session-v1"
         and packet.get("network") == "fixture-only", "Unsupported fixture session")
    need(type(packet.get("profile")) in (int, float) and packet["profile"] == 0
         and packet.get("expectedPublicKeyHex") == PUBLIC.hex(),
         "Only the published test key and profile 0 are accepted")
    need(packet.get("upstreamCommit") == UPSTREAM, "Incorrect upstream commit")
    value = packet.get("messageHex")
    need(isinstance(value, str) and len(value) <= 2334 and len(value) % 2 == 0
         and all(c in "0123456789abcdef" for c in value), "Invalid message hex")
    message = bytes.fromhex(value)
    review = parse_message(message)
    need(packet.get("review") == review, "Review metadata differs from the message")
    need(packet.get("messageSha256") == hashlib.sha256(message).hexdigest(), "SHA-256 mismatch")
    need(packet.get("messageSha512") == hashlib.sha512(message).hexdigest(), "SHA-512 mismatch")
    body = b"DTS02IN1" + b"\0\0" + len(message).to_bytes(2, "little") + PUBLIC + message
    envelope = body + zlib.crc32(body).to_bytes(4, "little")
    need(packet.get("envelopeHex") == envelope.hex(), "Envelope mismatch")
    return message, envelope


def sign(packet, upstream, firmware_policy=False):
    message, envelope = validate(packet)
    modules = load_pinned(upstream, UPSTREAM)
    fw_module, harness, solana, emu = [modules[name] for name in
                                      ("signer_fw", "signer_harness", "solana", "emu")]
    with isolated_emulator(emu):
        fw = harness.Fw(double_sign=True, verify=True)
        policy_resources = None
        if firmware_policy:
            from tools.firmware_policy import build
            fw.img, fw.syms, _, policy_resources = build(fw_module, modules["asm"])
            fw.m = emu.Machine(rom=fw.img)
        need(len(envelope) < fw_module.SEED - fw_module.ENV, "Envelope overlaps seed memory")
        fw.put(fw_module.SEED, SEED)
        fw.put(fw_module.ENV, envelope)
        cycles = fw.call("sign_main")
        m = fw.m.m
        record = fw.get(fw_module.REC, 256)
        signature = record[44:108]
        need(fw.get(fw_module.ZP["STATUS"], 1) == b"\0", "Firmware rejected the envelope")
        need((m.msg_lock, m.res_lock, m.fault, m.blocked_writes) == (1, 1, 0, 0), "Firmware lock/fault failure")
        need(fw.get(fw_module.MSG, len(message)) == message, "Frozen message changed")
        need(fw.get(0x0200, 0x3E00) == bytes(0x3E00), "Emulated scratch wipe failed")
        need(record == fw_module.expected_record(message, PUBLIC, signature), "Result record mismatch")
        need(signature == solana.openssl_sign(SEED, message), "OpenSSL signature mismatch")
        need(solana.openssl_verify(PUBLIC, message, signature), "OpenSSL verification failed")
        result = {
            "schema": "dts-console-result-v1", "sessionSha256": packet["messageSha256"],
            "recordHex": record.hex(),
            "evidence": {
                "engine": "DTS-02 65C02 firmware on the upstream C emulator",
                "upstreamCommit": UPSTREAM, "romSha256": hashlib.sha256(fw.img).hexdigest(),
                "cycles": cycles, "doubleSign": True, "firmwareVerify": True,
                "opensslVerified": True, "messageLocked": True, "resultLocked": True,
                "fault": False, "blockedWrites": 0, "emulatedScratchWiped": True,
                "hardwareMeasured": False, "onDevicePolicyImplemented": False,
                "hostPolicy": "console-canonical-sol-v1"
            }
        }
        if policy_resources is not None:
            result["evidence"]["engine"] = "DTS-02 65C02 firmware with experimental Console parser on the upstream C emulator"
            result["evidence"]["firmwareParser"] = policy_resources
            result["evidence"]["preSignPolicyGate"] = True
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session", type=pathlib.Path)
    parser.add_argument("--upstream", type=pathlib.Path, default=ROOT / ".upstream" / "dts02")
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--firmware-policy", action="store_true",
                        help="Use the experimental profile-0 65C02 parser; no live-key authorization")
    args = parser.parse_args()
    need(args.session.stat().st_size <= 16000, "Session file is too large")
    packet = json.loads(args.session.read_text())
    result = sign(packet, args.upstream, firmware_policy=args.firmware_policy)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"result": str(args.output), "cycles": result["evidence"]["cycles"],
                      "opensslVerified": True, "hardwareMeasured": False}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, RuntimeError) as error:
        print("Refused: " + str(error), file=sys.stderr)
        sys.exit(1)
