"""Execute real 65C02 parser bytes; bypass host policy for adversarial inputs."""
import hashlib
import json
import os
import pathlib
import subprocess
import unittest

from tools.firmware_policy import build, replace_once
from tools.sign_fixture import PUBLIC, SEED, UPSTREAM, b58, parse_message
from tools.upstream import isolated_emulator, load_pinned
from policy_vectors import MESSAGES, vectors

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPORT = {"parserExecutions": 0, "differentialVectors": 0, "acceptedVectors": 0,
          "rejectedVectors": 0, "pythonCoreVectors": 0, "maxObservedParserCycles": 0,
          "maxObservedParserCallStackBytes": 0, "declaredLengthsChecked": 0,
          "rawEnvelopeGateRejections": 0}


class FirmwarePolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.modules = load_pinned(os.environ.get("DTS_UPSTREAM", ROOT / ".upstream/dts02"), UPSTREAM)
        cls.F = cls.modules["signer_fw"]
        cls.image, cls.syms, cls.source, resources = build(cls.F, cls.modules["asm"])
        REPORT["resources"] = resources
        cls.emulator_context = isolated_emulator(cls.modules["emu"])
        cls.emulator_context.__enter__()
        cls.addClassCleanup(cls.emulator_context.__exit__, None, None, None)

    def machine(self, message, length=None, profile=0, public_key=PUBLIC, state=1, direct=False):
        machine = self.modules["emu"].Machine(rom=self.image)
        # Dirty scratch catches accidental reliance on emulator-zeroed memory.
        machine.load(0, bytes([0xA5]) * 0x4000)
        machine.load(0x4000, message)
        machine.load(0x5000, (len(message) if length is None else length).to_bytes(2, "little")
                     + bytes([profile]) + public_key)
        machine.m.msg_lock, machine.m.res_lock, machine.m.fault = state & 1, (state >> 1) & 1, (state >> 2) & 1
        machine.m.s = 0xFF
        machine.m.p |= 8  # parser must clear decimal mode itself
        machine.m.pc = self.syms["dts_policy_check" if direct else "dts_policy_test"]
        return machine

    def execute(self, message, **kwargs):
        machine = self.machine(message, **kwargs)
        status = machine.run(stop=self.syms["dts_policy_hold_loop"], max_cycles=20000)
        REPORT["parserExecutions"] += 1
        REPORT["maxObservedParserCycles"] = max(REPORT["maxObservedParserCycles"], machine.cycles)
        self.assertEqual(status, machine.STP, f"parser did not return for {message.hex()}")
        accepted = machine.m.a == 0 and not machine.m.p & 1
        self.assertEqual(machine.m.s, 0xFF)
        self.assertEqual(machine.m.blocked_writes, 0)
        self.assertEqual((machine.m.msg_lock, machine.m.res_lock, machine.m.fault), (1, 0, 0))
        self.assertEqual(machine.read(0x4000, len(message)), message)
        if not accepted:
            self.assertTrue(machine.m.p & 1)
            self.assertEqual(machine.read(self.syms["DTS_AMOUNT"], 3), bytes(3))
        return accepted, machine

    def test_differential_corpus_against_both_host_decoders(self):
        corpus = list(vectors())
        proc = subprocess.run(["node", "tests/policy_oracle.mjs"], cwd=ROOT,
                              input=json.dumps([message.hex() for _, message in corpus]),
                              text=True, capture_output=True, timeout=60, check=True)
        js = json.loads(proc.stdout)
        self.assertEqual(len(js), len(corpus))
        digest = hashlib.sha256()
        for (name, message), expected_js in zip(corpus, js):
            with self.subTest(vector=name):
                digest.update(name.encode() + b"\0" + message)
                try:
                    review = parse_message(message)
                    expected_py = {"accepted": True, "review": review}
                except ValueError:
                    expected_py = {"accepted": False}
                self.assertEqual(expected_py, expected_js)
                accepted, machine = self.execute(message)
                self.assertEqual(accepted, expected_py["accepted"])
                if accepted:
                    offset = machine.read(self.syms["DTS_RECIP"], 1)[0]
                    amount = machine.read(self.syms["DTS_AMOUNT"], 1)[0]
                    kind = machine.read(self.syms["DTS_KIND"], 1)[0]
                    self.assertEqual(kind, 2 if review["nonceAccount"] else 1)
                    self.assertEqual(b58(machine.read(0x4000+offset, 32)), review["recipient"])
                    self.assertEqual(str(int.from_bytes(machine.read(0x4000+amount, 8), "little")), review["lamports"])
                REPORT["acceptedVectors" if accepted else "rejectedVectors"] += 1
        REPORT["differentialVectors"] = len(corpus)
        REPORT["corpusSha256"] = digest.hexdigest()

    def test_every_u16_length_except_exact_forms_is_rejected(self):
        # Reuse memory deliberately: rejection must invalidate a prior success.
        machine = self.machine(MESSAGES[0])
        for length in range(65536):
            if length == 224:
                continue  # exercised with its own canonical message below
            machine.load(0x5000, length.to_bytes(2, "little"))
            machine.m.pc = self.syms["dts_policy_test"]
            machine.m.s = 0xFF
            machine.m.halted = 0
            status = machine.run(max_cycles=20000)
            self.assertEqual(status, machine.STP, length)
            self.assertEqual(machine.m.a == 0 and not machine.m.p & 1, length == 150, length)
            if length != 150:
                self.assertEqual(machine.read(self.syms["DTS_AMOUNT"], 3), bytes(3), length)
        accepted, _ = self.execute(MESSAGES[1], length=224)
        self.assertTrue(accepted)
        REPORT["declaredLengthsChecked"] = 65536
        REPORT["parserExecutions"] += 65535

    def test_all_unknown_profiles_and_each_expected_key_byte_are_rejected(self):
        for message in MESSAGES:
            for profile in range(1, 256):
                with self.subTest(length=len(message), profile=profile):
                    accepted, _ = self.execute(message, profile=profile)
                    self.assertFalse(accepted)
            for offset in range(32):
                public = bytearray(PUBLIC)
                public[offset] ^= 1
                accepted, _ = self.execute(message, public_key=bytes(public))
                self.assertFalse(accepted)

    def run_python_core(self, message, state=1, length=None):
        machine = self.machine(message, state=state, length=length, direct=state != 1)
        memory = bytearray(machine.read(0, 65536))
        before = bytes(memory)
        core = self.modules["cpu65c02"].Core()
        core.pc, core.s, core.p = machine.m.pc, 0xFF, 0x3C
        reads, writes, min_stack, cycles = set(), [], 0xFF, 0
        # The Python core deliberately traps STP; stop both cores at the same
        # instruction boundary immediately before the harness-only halt opcode.
        return_pc = self.syms["dts_policy_test"] + 3
        while core.pc not in (self.syms["dts_policy_hold_loop"], return_pc):
            generator = core.step()
            try:
                event = next(generator)
                while True:
                    operation, address, value, _ = event
                    cycles += 1
                    self.assertLess(cycles, 20000)
                    if operation == "R":
                        reads.add(address)
                        value = state << 5 if address == 0x7F01 else memory[address]
                    else:
                        writes.append((address, value))
                        memory[address] = value
                        value = None
                    event = generator.send(value)
            except StopIteration:
                pass
            min_stack = min(min_stack, core.s)
        REPORT["pythonCoreVectors"] += 1
        REPORT["maxObservedParserCallStackBytes"] = max(REPORT["maxObservedParserCallStackBytes"], 0xFF-min_stack)
        if state != 1:
            self.assertEqual(core.pc, self.syms["dts_policy_hold_loop"])
            self.assertEqual(writes, [(0x7F02, 0)])
            self.assertFalse(any(address < 0x7F00 for address in reads))
            self.assertEqual(min_stack, 0xFF)
            self.assertEqual(memory[:0x7F00], before[:0x7F00])
            return
        c_machine = self.machine(message, **({"length": length} if length is not None else {}))
        self.assertEqual(c_machine.run(stop=return_pc, max_cycles=20000), c_machine.STOP)
        accepted = c_machine.m.a == 0 and not c_machine.m.p & 1
        REPORT["parserExecutions"] += 1
        self.assertEqual((core.a, core.x, core.y, core.p, core.s, core.pc),
                         (c_machine.m.a, c_machine.m.x, c_machine.m.y, c_machine.m.p,
                          c_machine.m.s, c_machine.m.pc))
        self.assertEqual(memory[:0x7F00], c_machine.read(0, 0x7F00))
        allowed_writes = set(range(0x61, 0x6C)) | {0x1FE, 0x1FF}
        self.assertTrue(set(address for address, _ in writes) <= allowed_writes)
        allowed_reads = set(range(0x61, 0x6C)) | {0x1FD, 0x1FE, 0x1FF, 0x7F01}
        allowed_reads |= set(range(0x5000, 0x5023))
        allowed_reads |= set(range(0x4000, 0x4000+len(message)))
        self.assertTrue({address for address in reads if address < 0x8000} <= allowed_reads)
        self.assertEqual(min_stack, 0xFD)
        return accepted

    def test_independent_python_core_bus_and_stack_accounting(self):
        selected = [(name, message) for name, message in vectors()
                    if name.endswith(("original", "keys-differ-last-byte", "long-zero-prefixes", "amount/0", "amount/18446744073709551615"))]
        selected += [("bad-header", b"\x81" + MESSAGES[0][1:]),
                     ("bad-sysvar", MESSAGES[1][:100] + bytes(32) + MESSAGES[1][132:])]
        for name, message in selected:
            with self.subTest(vector=name):
                self.run_python_core(message)
        for length in (0, 149, 151, 223, 225, 4096, 65535):
            self.run_python_core(MESSAGES[0], length=length)

    def test_all_invalid_lock_states_hold_without_sram_or_stack_access(self):
        for state in (0, 2, 3, 4, 5, 6, 7):
            self.run_python_core(MESSAGES[0], state=state)
            machine = self.machine(MESSAGES[0], state=state, direct=True)
            before = machine.read(0, 0x7F00)
            status = machine.run(stop=self.syms["dts_policy_hold_loop"], max_cycles=100)
            self.assertEqual(status, machine.STOP)
            self.assertEqual(machine.read(0, 0x7F00), before)
            self.assertEqual(machine.m.blocked_writes, 0)
            self.assertEqual(machine.m.s, 0xFF)
            self.assertEqual(machine.io_addresses_written(), {0x7F02})

    def frozen_machine(self, message, profile=0, public_key=PUBLIC):
        machine = self.modules["emu"].Machine(rom=self.image)
        machine.load(self.F.SEED, SEED)
        machine.load(self.F.ENV, self.F.envelope(message, public_key, profile))
        machine.m.s = 0xFF
        machine.m.pc = self.syms["t_sign_main"]
        status = machine.run(stop=self.syms["dts_policy_check"], max_cycles=1000000)
        return status, machine

    def test_raw_envelopes_with_correct_crc_cannot_bypass_firmware_gate(self):
        cases = []
        for message in MESSAGES:
            for offset in (0, 1, 2, 3, len(message)-9):
                changed = bytearray(message)
                changed[offset] ^= 1
                cases.append(bytes(changed))
            cases += [message[:-8] + bytes(8), message + b"\0", message[:-1]]
            changed = bytearray(message)
            recipient = 68 if len(message) == 224 else 36
            changed[recipient:recipient+32] = message[4:36]
            cases.append(bytes(changed))
        for message in cases:
            with self.subTest(message=message.hex()):
                status, machine = self.frozen_machine(message)
                self.assertEqual(status, machine.STOP)  # real CRC check and freeze ran
                self.assertEqual(machine.m.msg_lock, 1)
                status = machine.run(stop=self.syms["dts_policy_hold_loop"], max_cycles=20000)
                self.assertEqual(status, machine.STOP)
                self.assertEqual(machine.m.res_lock, 0)
                self.assertEqual(machine.read(self.F.REC, 256), bytes(256))
                self.assertEqual(machine.read(self.F.SEED, 32), SEED)
                self.assertEqual(machine.m.blocked_writes, 0)
                REPORT["rawEnvelopeGateRejections"] += 1

    def test_production_profiles_stay_disabled_before_freeze(self):
        for profile in (1, 2, 255):
            status, machine = self.frozen_machine(MESSAGES[0], profile=profile)
            self.assertEqual(status, machine.STP)
            self.assertEqual(machine.read(self.F.ZP["STATUS"], 1), b"\xEE")
            self.assertEqual((machine.m.msg_lock, machine.m.res_lock), (0, 0))
            self.assertEqual(machine.read(self.F.REC, 256), bytes(256))

    def test_bad_magic_reserved_crc_and_oversized_envelopes_never_reach_the_gate(self):
        envelope = self.F.envelope(MESSAGES[0], PUBLIC)
        for offset in (0, 7, 9, 11, len(envelope)-1):
            with self.subTest(offset=offset):
                changed = bytearray(envelope)
                changed[offset] ^= 0x80 if offset == 11 else 1
                machine = self.modules["emu"].Machine(rom=self.image)
                machine.load(self.F.ENV, changed)
                machine.load(self.F.SEED, SEED)
                machine.m.s = 0xFF
                machine.m.pc = self.syms["t_sign_main"]
                status = machine.run(stop=self.syms["dts_policy_check"], max_cycles=1000000)
                self.assertEqual(status, machine.STP)
                self.assertEqual(machine.read(self.F.ZP["STATUS"], 1), b"\xEE")
                self.assertEqual((machine.m.msg_lock, machine.m.res_lock), (0, 0))
                self.assertEqual(machine.read(self.F.REC, 256), bytes(256))

    def test_correct_crc_with_another_envelope_key_is_rejected_before_signing(self):
        other = bytes([PUBLIC[0] ^ 1]) + PUBLIC[1:]
        status, machine = self.frozen_machine(MESSAGES[0], public_key=other)
        self.assertEqual(status, machine.STOP)
        status = machine.run(stop=self.syms["dts_policy_hold_loop"], max_cycles=20000)
        self.assertEqual(status, machine.STOP)
        self.assertEqual(machine.m.a, 0)  # hold blanks GPIO after the E3 rejection
        self.assertEqual(machine.m.res_lock, 0)
        self.assertEqual(machine.read(self.F.REC, 256), bytes(256))

    def test_parser_reads_frozen_bytes_even_if_input_envelope_changes(self):
        for message in MESSAGES:
            status, machine = self.frozen_machine(message)
            self.assertEqual(status, machine.STOP)
            machine.load(self.F.ENV, bytes(48+len(message)))
            status = machine.run(stop=self.syms["sign"], max_cycles=20000)
            self.assertEqual(status, machine.STOP)
            self.assertEqual(machine.read(self.F.MSG, len(message)), message)
            self.assertEqual(machine.read(self.syms["DTS_KIND"], 1), b"\x02" if len(message) == 224 else b"\x01")

    def test_a_cpu_write_to_the_locked_message_faults_and_cannot_reach_signing(self):
        address = self.syms["dts_policy_after_test"]
        stub, _ = self.modules["asm"].assemble(
            f".org ${address:04X}\nLDA #$99\nSTA $4024\nJMP dts_policy_check",
            symbols={"dts_policy_check": self.syms["dts_policy_check"]})
        machine = self.machine(MESSAGES[0], direct=True)
        machine.load(address, stub[address-0x8000:address-0x8000+8])
        machine.m.pc = address
        status = machine.run(stop=self.syms["dts_policy_hold_loop"], max_cycles=100)
        self.assertEqual(status, machine.STOP)
        self.assertEqual(machine.m.blocked_writes, 1)
        self.assertEqual(machine.m.fault, 1)
        self.assertEqual(machine.m.res_lock, 0)
        self.assertEqual(machine.read(0x4000, len(MESSAGES[0])), MESSAGES[0])
        self.assertEqual(machine.m.s, 0xFF)

    def test_resource_accounting_and_integration_anchors(self):
        resources = REPORT["resources"]
        self.assertEqual(resources["romBytes"], 32768)
        self.assertGreater(resources["bytesBeforeVectors"], 0)
        self.assertEqual(resources["scratchBytes"], 11)
        # Changed/ambiguous integration anchors must fail, never silently omit a gate.
        for text in ("nothing", "anchor anchor"):
            with self.assertRaises(ValueError):
                replace_once(text, "anchor", "replacement")
        image, symbols, _, again = build(self.F, self.modules["asm"])
        self.assertEqual(image, self.image)
        self.assertEqual(symbols, self.syms)
        self.assertEqual(again, resources)


if __name__ == "__main__":
    unittest.main()
