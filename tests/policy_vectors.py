"""Public deterministic parser inputs; none contains a private user key."""
import json
import pathlib
import random

ROOT = pathlib.Path(__file__).resolve().parents[1]
PACKETS = [json.loads((ROOT / "dist" / (name + "-session.json")).read_text())
           for name in ("fixture", "nonce-fixture")]
MESSAGES = [bytes.fromhex(packet["messageHex"]) for packet in PACKETS]


def vectors():
    rng = random.Random(0xD7502)
    for n, message in enumerate(MESSAGES):
        prefix = "nonce" if n else "legacy"
        yield prefix + "/original", message
        for length in range(len(message)):
            yield f"{prefix}/truncated/{length}", message[:length]
        for extra in (b"\x00", b"\xff", bytes(32), bytes(1168)):
            yield f"{prefix}/appended/{len(extra)}/{extra[0]}", message + extra
        # Every bit of every byte, including all 64 account/hash bytes that can
        # legitimately change. The host decoders decide acceptance independently.
        for offset in range(len(message)):
            for bit in range(8):
                changed = bytearray(message)
                changed[offset] ^= 1 << bit
                yield f"{prefix}/bit/{offset}/{bit}", bytes(changed)
        # Duplicate every account pair, in either direction.
        for a in range(message[3]):
            for b in range(message[3]):
                if a != b:
                    changed = bytearray(message)
                    changed[4+32*a:36+32*a] = message[4+32*b:36+32*b]
                    yield f"{prefix}/duplicate/{a}/{b}", bytes(changed)
        for amount in (0, 1, 255, 256, 2**32-1, 2**32, 2**53-1, 2**53,
                       2**63-1, 2**63, 2**64-1):
            yield f"{prefix}/amount/{amount}", message[:-8] + amount.to_bytes(8, "little")
        # Overlong compact-u16 encodings, both with and without trailing-byte
        # compensation (a deceptive input can still have exactly 150/224 bytes).
        compact_offsets = (3, 196, 198, 202, 208, 211) if n else (3, 132, 134, 137)
        for offset in compact_offsets:
            for suffix in (b"\x00", b"\x80\x00", b"\xff\x7f"):
                changed = message[:offset] + bytes([message[offset] | 128]) + suffix + message[offset+1:]
                yield f"{prefix}/compact/{offset}/{suffix.hex()}", changed
                yield f"{prefix}/compact-same-length/{offset}/{suffix.hex()}", changed[:len(message)]
        for i in range(128):
            changed = bytearray(message)
            recipient = 68 if n else 36
            changed[recipient:recipient+32] = bytes(rng.randrange(256) for _ in range(32))
            blockhash = 164 if n else 100
            changed[blockhash:blockhash+32] = bytes(rng.randrange(256) for _ in range(32))
            if n:
                changed[36:68] = bytes(rng.randrange(256) for _ in range(32))
            changed[-8:] = rng.randrange(1, 2**64).to_bytes(8, "little")
            yield f"{prefix}/valid-random/{i}", bytes(changed)
        for i in range(1024):
            changed = bytearray(message)
            for _ in range(rng.randrange(1, 17)):
                changed[rng.randrange(len(changed))] = rng.randrange(256)
            yield f"{prefix}/mutated-random/{i}", bytes(changed)
        # Long common prefixes force duplicate checks to read the last byte.
        changed = bytearray(message)
        recipient = 68 if n else 36
        changed[recipient:recipient+32] = message[4:36]
        changed[recipient+31] ^= 1
        yield prefix + "/keys-differ-last-byte", bytes(changed)
        changed = bytearray(message)
        changed[recipient:recipient+32] = bytes(31) + b"\x01"
        if n:
            changed[36:68] = bytes(31) + b"\x02"
        yield prefix + "/long-zero-prefixes", bytes(changed)
    for i, length in enumerate((0, 1, 149, 150, 151, 223, 224, 225, 1167, 1168, 4096)):
        yield f"arbitrary/{i}", bytes(rng.randrange(256) for _ in range(length))
