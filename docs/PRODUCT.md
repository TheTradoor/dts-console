# Product scope

## Intended use

The long-term direction is an offline DTS-02 co-signer and a companion Console
for infrequent Solana treasury operations. The published upstream design uses
a distinct third device in a 2-of-3 Squads arrangement. It supplies one vote;
the other two members can form a quorum without it.

The current audience is developers evaluating that design. The immediate value
is a repeatable workflow: construct a narrowly scoped public fixture, inspect
the bytes, execute the actual signing core and independently verify the result.

## Current release

Version 0.1.1 includes a static Prepare/Review/Verify/Readiness interface, two
canonical SOL fixture forms, independent JavaScript and Python host parsers,
source pinning, actual-firmware emulator execution and signature verification.

It does not include a live wallet, funds handling, seed input, transaction
broadcast, Squads execution, physical device or on-device authorization policy.

## Product direction

Keep preparation and result verification on the companion host. Keep the
trusted authorization decision inside a minimal offline device with its own
parser, display, confirmation state machine and physical security boundary.
The host's review screen is useful during development but cannot become the
device's source of truth.

The next engineering target is a reviewed restricted SOL policy inside the
65C02 firmware, including adversarial vectors and ROM/RAM/stack accounting.
Squads work then needs an exact serialized composite and local-validator
evidence. Hardware work requires an embedded/electronics engineer and physical
measurements.

See [ROADMAP.md](ROADMAP.md) for observable acceptance criteria.

## Release and business boundaries

A public-key developer kit follows physical measurements with public keys.
A live-key device needs the completed architecture, independent review and
documented custody/recovery procedures.

Potential commercial distribution requires clarification of upstream licensing.
A separate token is under consideration but has no implemented role in this
prototype. Product progress and any future token proposal must remain separately
verifiable. No affiliation, approval or endorsement by upstream is claimed.
