# Threat model

## Current scope

Public fixture development on a trusted host. Every signature uses RFC 8032
test vector 1's published key. Anyone can produce these signatures. No private
key, funds, hardware provenance or production custody is protected by this build.

## Inputs treated as untrusted

- Imported session JSON and result JSON.
- Serialized message, envelope and result bytes.
- User-entered amount and recipient.
- Descriptive result evidence, including claims about emulator or hardware runs.
- Downloaded upstream bytes until their hashes match the checked-in manifest.

The parsers reject malformed lengths, noncanonical encodings, unsupported
account layouts and permissions, unexpected instructions, trailing bytes,
metadata/byte disagreement, incorrect hashes and invalid output records.
Result verification binds the signature to the frozen message and expected
public key; changing the amount or recipient invalidates that result.

CRC detects accidental corruption. It is not authentication; tests also alter
records while recomputing CRC to exercise the binding and signature checks.

## Explicitly outside this release

- Compromise of the browser, operating system, compiler, Python import path,
  source pins, delivery server or development dependencies.
- Physical secret erasure, isolated power domains, back-power paths, side
  channels, probing, fault injection or restricted physical output channels.
- Trusted on-device display, manual secret entry, complete reset/fault handling
  and the on-device profile 1/2 authorization parser.
- Live-chain nonce freshness, account ownership, balances, simulation,
  transaction execution, Squads proposal races or replay protection.
- Availability, treasury recovery, seed custody or protection from other
  members of a multisig quorum.

The eventual distinct third signer in a 2-of-3 Squads arrangement would provide
one vote. The other two members can form a quorum without it. It cannot be
presented as a veto unless the actual authorization design changes.

## Why the bridge cannot secure a real key

Profile 0 receives message bytes from the host. The independent Python policy
helps detect development mistakes, but an attacker controlling the host can
remove it. The signing core does not thereby acquire an on-device policy.

Source hashes show which source bytes were selected, not that those bytes or
their execution environment are safe. Emulated scratch clearing shows the
emulator's memory contents, not electrical erasure on a physical board.

Report findings through [SECURITY.md](../SECURITY.md). Include only published
fixtures or synthetic test data.
