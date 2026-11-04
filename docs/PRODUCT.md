# Product scope

## Product decision

DTS Console is a software product built around DTS-02 transaction preparation,
review and result verification. Physical hardware development, PCB design,
assembly, manufacturing and hardware sales are outside this project's scope.
This is a permanent product boundary, not a deferred Console milestone.

The productization model is to turn an upstream engineering foundation into
usable application workflows and integrations, as illustrated by percolator.trade.
It does not imply the same application, implementation, licensing or endorsement.

## Intended users and value

The intended users are Solana treasury operators and developers who need to
inspect exactly what a restricted transaction proposes. The software should
make addresses, integer amounts, instructions, state dependencies and returned
signatures understandable and reproducible before any external signing step.

The current release is a development tool. It does not yet complete a production
Squads treasury workflow. Its utility today is reproducible DTS public-fixture
signing and verification, plus offline preparation and strict review of a narrow
unsigned Squads draft. A successful draft is not an on-chain proposal or approval.

## Version 0.3.0

- Retains canonical SOL fixture preparation, frozen-byte review, public-profile-0
  firmware emulation and independent Ed25519 result verification.
- Adds an unsigned Squads v4 composite: nonce advancement, restricted vault SOL
  transaction creation, active proposal creation and the member's first approval.
- Derives vault/transaction/proposal addresses, decodes the serialized bytes and
  exports a bound JSON draft. Manual state comparisons detect changed index or
  nonce values; matching manual values do not authenticate chain state.
- Uses the pinned Squads SDK as a test oracle. The browser uses the Console's
  narrow codec and existing pinned crypto; no Squads SDK bundle is redistributed.

No private-key input, wallet connection, RPC request, transaction broadcast or
on-chain execution is implemented. The DTS bridge still rejects Squads messages;
this release does not silently extend its signing policy.

## Alignment with DTS-02

The published upstream specification describes a distinct offline signer as one
member of a 2-of-3 Squads arrangement. The Console follows its proposed atomic
creation-and-first-approval direction rather than trusting an existing proposal
snapshot as signer authorization. The companion never equates its host review or
emulator with the independent security boundary of an external signer.

The upstream device's physical isolation, erasure and trusted approval remain
external requirements for anyone claiming a live-key DTS signer. They are not
Console hardware deliverables and do not block development of software-only
preparation, compatibility testing and verification features.

## Next acceptance gate

Execute the exact composite against a pinned Squads program in a local validator.
Test competing transaction creation, changed nonce and consumed-nonce replay;
record account, fee and nonce outcomes. Then add read-only chain-state retrieval
and bind the reviewed message to those results without overstating their trust.

See [ROADMAP.md](ROADMAP.md) and [SQUADS.md](SQUADS.md).

## Release and business boundaries

Commercial distribution remains subject to the relevant upstream licensing terms.
Original Console code and fetched upstream components stay separate. No Toly,
Solana or Squads endorsement is claimed. No token role is implemented; any token
proposal must establish its own functional use separately from the software.
