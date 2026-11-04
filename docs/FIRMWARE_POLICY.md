# Experimental 65C02 SOL parser

Version 0.2.0 adds a small original assembly parser and an opt-in integration
with the pinned upstream signing ROM. It runs on the emulated 65C02, after the
message bank is locked and before the first signature. It is a development
step toward M1, not completion of the on-device authorization milestone.

Only profile 0 and the published RFC 8032 vector 1 public key are accepted.
Profiles 1 and 2 remain disabled. There is no trusted display/approval flow,
complete boot/recovery state machine, physical device or support for user keys.
No upstream approval or independent security review is claimed.

## Run it

    python3 tools/fetch_upstream.py
    python3 tools/sign_fixture.py dist/fixture-session.json --firmware-policy --output artifacts/policy-result.json

Import that result into the existing Console. It has the same signed record
as the baseline fixture, with different, unsigned emulator evidence. The
browser verifies the signed bytes; it does not attest which ROM produced them.

Without `--firmware-policy`, the bridge still executes the unmodified upstream
ROM and reproduces the existing 0.1.1 records and evidence exactly.

## Accepted message language

The input is the raw legacy Solana message, not a full signed transaction.
Every vector-length field must have its exact single-byte canonical encoding.

| Property | Legacy transfer | Durable-nonce transfer |
| --- | --- | --- |
| Exact message bytes | 150 | 224 |
| Header | 1 required signer, 0 readonly signed, 1 readonly unsigned | 1 required signer, 0 readonly signed, 2 readonly unsigned |
| Account order | Test signer, recipient, System Program | Test signer, nonce account, recipient, RecentBlockhashes sysvar, System Program |
| Instruction order | System transfer | Advance nonce, then System transfer |
| Transfer accounts | 0, 1 | 0, 2 |
| Nonce accounts | None | 1, 3, 0 (nonce, sysvar, authority) |
| Amount | Nonzero little-endian u64 lamports | Nonzero little-endian u64 lamports |

Every pair of account keys must differ. The signer and metadata expected key
must match the key compiled into the ROM. Program IDs, sysvar ID, instruction
discriminators, permissions, instruction/account/data counts and account indices
are exact. Unknown operations, versioned messages, extra instructions,
noncanonical counts, extra bytes within the declared message and zero amounts
are rejected. This ABI assumes the caller has collected the declared input;
a complete device input/framing routine remains to be implemented.

This is a deliberately narrow language, not a general Solana decoder. Other
semantically valid transactions may be rejected. Hash/nonce values are accepted
as opaque 32-byte fields: freshness, account existence/ownership, balances and
on-chain validity are not checked. Nonce protocol compatibility needs separate
validation before any live-chain integration.

## Parser ABI and trust boundary

Source: [firmware/sol_policy.s](../firmware/sol_policy.s).

- Entry: `dts_policy_check`; the caller has initialized the stack.
- Input: message at `$4000`; u16 length at `$5000`, profile at `$5002`, expected
  key at `$5003`. These addresses are in the same locked message bank.
- Latch requirement: MESSAGE_LOCK=1, RESULT_LOCK=0, FAULT=0. Any other state
  goes directly to the ROM-only hold; it blanks GPIO and performs no SRAM or
  stack access inside the parser/hold path.
- Return: A=0 and carry clear on success; carry set and A=`$E1..$E6` on a
  parsing error. A/X/Y and flags are clobbered; decimal mode is cleared.
- Scratch: `$0061..$006B`. The parser makes no calls or pushes; its caller's
  JSR uses two stack bytes. The integration has the upstream caller's stack
  usage as well; two bytes is not a bound for the complete signing firmware.
- On success only: `$006B` is kind 1/2; `$006A` is the recipient offset (36/68)
  and `$0069` the amount offset (142/216), relative to frozen `$4000`.
- On parsing failure, these three output bytes are cleared. On an invalid
  latch state, SRAM cannot be cleared safely and the routine never returns.
  Callers must never interpret old scratch as a new successful review.

Error codes are E1 profile, E2 length, E3 expected/signer key, E4 layout or
constant, E5 zero amount and E6 duplicate account. They are development return
codes, not a finished device UI.

The current review outputs are byte offsets into locked memory, not copied
host labels. A future trusted display must read the actual bytes at those
offsets, label all fields, require full review and bind approval to that same
frozen message. This extension does not implement those steps.

## Integration

[tools/firmware_policy.py](../tools/firmware_policy.py) first checks the exact
baseline ROM hash. It requires a unique, pinned source insertion point after
MESSAGE_LOCK. The inserted code calls the parser and proceeds to the original
double-sign-and-verify path only on success. Parser rejection enters a ROM-only
hold and releases no result. Envelope rejection still follows the upstream
fixture failure path, which is not the final device's recovery state machine.

The original cryptographic routines, profile restriction, envelope CRC check
and signing result format are retained. The derived ROM and fetched upstream
source are not distributed in the repository or development kit. The CLI
accepts no seed input and uses the published test seed only.

The parser entry guard does not repair the upstream reset entry: that entry
can touch the stack before the guard. Testing the parser's fault hold therefore
does not prove safe whole-device reset/fault recovery. The existing ROM also
contains diagnostic test entry points. This remains a public-data experiment.

## Resource evidence

| Measurement | Result |
| --- | --- |
| Complete ROM image | 32,768 bytes |
| Parser code and constant tables | 418 bytes |
| Pre-sign gate | 8 bytes, absorbed by existing alignment space |
| Test call stub | 4 bytes |
| Parser range | `$FB98..$FD39` |
| Free tail before interrupt vectors | 700 bytes |
| New scratch | 11 bytes, `$0061..$006B` |
| Parser internal stack use | 0 bytes |
| Measured parser call stack use | 2 bytes |

The assembler rejects overlap with the interrupt vectors. The builder checks
scratch separation from the pinned crypto layout. Bus tracing also checks the
actual read/write address sets on selected success and rejection paths.
700 remaining tail bytes are not a budget for a complete display, recovery
state machine, Squads parser or PDA verification; those still need a combined
ROM/stack design. See the generated report for hashes and observed cycle counts.

## Validation

    python3 tools/verify.py --fetch-upstream --report artifacts/validation.json

The firmware tests supply raw bytes directly to the emulator, bypassing both
host validators. They compare 5,803 deterministic vectors with the JavaScript
and Python decoders, including every single-bit mutation of both fixtures,
truncations, appended bytes, duplicate account pairs, malformed compact-u16
encodings, amount boundaries, random valid fields and seeded mutations.
The 65,536 possible declared u16 lengths and all unknown u8 profiles are checked
separately. Accepted cases also compare the extracted recipient and amount.

Selected paths run on both the pinned C and Python CPU implementations. The
Python bus trace checks scratch/stack writes and rejects reads outside the
permitted input/metadata/scratch regions. Invalid latch states use a direct
parser entry so that no test-harness JSR hides a forbidden stack access.

Integration checks use correctly CRC-sealed but unsupported messages, an
altered expected key, corrupted envelopes, disabled profiles, a changed input
envelope after freezing and a CPU write to a locked message bank. Two complete
signing runs with the extension must reproduce their checked-in evidence and
the baseline signed record, including independent OpenSSL comparison. Two
unmodified baseline runs must also reproduce unchanged.

These are deterministic regression and adversarial tests, not an audit, a
formal proof, exhaustive coverage of all messages or a physical measurement.
The measured maximum cycle count is only the maximum in this test corpus.

## Remaining M1 work

1. Independent review of the accepted language, assembly, integration and tests.
2. Trusted device review of recipient, amount, source and nonce fields, followed
   by deliberate confirmation; no signing before that confirmation.
3. Full boot, reset, parser-failure and fault behavior without unsafe stack/RAM
   access, including all interruption points.
4. Resource accounting for the complete linked firmware and its deepest stack
   path; physical timing and manual-input validation.
5. A separately reviewed decision to enable a production profile. This patch
   deliberately does not make that decision.
