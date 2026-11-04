# Product scope

## Product decision

DTS Console is a software product built around DTS-02 transaction preparation,
review and result verification. Physical hardware development, PCB design,
assembly, manufacturing and hardware sales are outside this project's scope.
This is a permanent product boundary, not a deferred Console milestone.

The user's intended model is useful software whose core function actually uses
DTS-02, analogous to the engine/application relationship illustrated by
percolator.trade. The current Console has not established that relationship for
a treasury product. A shared brand, reference to a specification or passing
browser tests does not establish it. No upstream endorsement is claimed.

## Product-fit review — 4 November 2026

Hold treasury feature expansion. Preserve version 0.3.0 as a development
companion while evaluating whether a DTS-dependent software workflow solves a
recurring user problem. This is not a decision to change engines or launch a
different product.

Source inspection distinguishes two paths already present in the application:

| Current path | Actual role of DTS | What the evidence supports |
| --- | --- | --- |
| Public-fixture signing and result verification | The bridge executes pinned DTS firmware in its emulator | Reproduction and comparison of that firmware's behavior |
| Unsigned Squads draft preparation and review | References the DTS integration specification, but never invokes its signing engine | Restricted draft construction and SDK compatibility |

`dist/squads.mjs` does not invoke `tools/sign_fixture.py`. The latter accepts only
public-key profile-0 SOL fixtures and rejects the Squads draft format. Therefore
extending the Squads screen alone would not make DTS the product's core engine.

The upstream [specification, sections 1, 10.5 and 12](https://github.com/aeyakovenko/dts02-6502-signer/blob/a7cbac2ed7093a3cd994c4b7f1109396cd1d2faf/spec.md)
describes a distinct offline signer and an integration that still requires
testing. Emulated signing is possible; it does not reproduce the design's
physical trust boundary. This is not a claim that all software signers are
impossible. A live-key software signer would need its own justified architecture,
key handling, review and user benefit.

Squads already documents [draft construction, transaction import and simulation](https://docs.squads.so/main/navigating-your-squad/developers-assets/transaction-builder).
Those features alone do not establish a reason to adopt another treasury app.

## Immediate validation work

Use the existing prototype to evaluate one narrow hypothesis before writing new
features: a developer integrating or modifying DTS can reproduce a supported
transaction's firmware result and identify a regression without assembling a
board. DTS execution is essential to that job. This is a candidate developer
tool, not a selected commercial product or evidence of customer demand.

1. Use the walkthrough below with an existing public fixture. A new treasury
   feature or live key is unnecessary for this evaluation.
2. Seek feedback from three relevant developers or integrators through explicitly
   authorized outreach. Record their last comparable task, current workaround,
   time or error cost, whether DTS execution matters, and willingness to use the
   tool on another task. Compliments, social engagement and Toly's name are not
   evidence of recurring need. No outreach has been performed.
3. Resume product expansion only with a documented recurring problem, a useful
   DTS-dependent workflow, and at least two of those participants willing to try
   it on a second task. This is an initial decision threshold, not proof of
   market fit or revenue. Confirm that a developer-focused product meets the
   owner's ambition before treating it as the chosen direction.

If this evidence is absent or the candidate's audience does not fit the owner's
goal, keep the Console as contribution/testing work and do not enlarge the
treasury application. Choosing another foundation is a separate product
decision; it has not been made. Technical feasibility and distribution rights
must also be established before any broader release.

### Walkthrough prepared for feedback

From a checkout with the [documented prerequisites](../README.md), show the
existing Prepare screen's **Load signed example**, then inspect its message and
recipient. The example is public test data. To reproduce that fixture's firmware
result locally, the existing commands are:

```sh
python3 tools/fetch_upstream.py
python3 tools/sign_fixture.py dist/fixture-session.json --output /tmp/dts-public-fixture-result.json
```

Use **Choose result file** in the Verify screen to check that output against the
loaded session. **Verify signed example** checks the bundled recorded result;
it does not perform a new signing run. Demonstrate the existing altered-signature
check, which also recalculates the CRC so rejection is not merely a checksum test:

```sh
node --test --test-name-pattern='a signature alteration remains rejected after the CRC is recomputed' tests/protocol.test.mjs
```

During this assessment that single rejection check passed. A separate direct
check constructed the 487-byte Squads example, validated its draft, and confirmed
that the fixture bridge rejects both its packet (`Unsupported fixture session`)
and its message (`Unsupported account layout`). No full firmware-signing or
browser suite was rerun; earlier reproductions remain in [VALIDATION.md](VALIDATION.md).
These checks establish the demonstration's scope, not demand or custody safety.

## Intended users and value

The original candidate users were Solana treasury operators and developers who
need to inspect exactly what a restricted transaction proposes. These are user
hypotheses, not validated customers. The software should
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

## Conditional technical acceptance gate

The product-fit review above comes first. If its outcome justifies continuing
the Squads workflow, execute the exact composite against a pinned Squads program
in a local validator.
Test competing transaction creation, changed nonce and consumed-nonce replay;
record account, fee and nonce outcomes. Then add read-only chain-state retrieval
and bind the reviewed message to those results without overstating their trust.

See [ROADMAP.md](ROADMAP.md) and [SQUADS.md](SQUADS.md).

## Release and business boundaries

Commercial distribution remains subject to the relevant upstream licensing terms.
Original Console code and fetched upstream components stay separate. No Toly,
Solana or Squads endorsement is claimed. No token role is implemented; any token
proposal must establish its own functional use separately from the software.
