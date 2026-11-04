# Roadmap and acceptance criteria

Milestones describe engineering evidence required for progress. They are not
release dates or commitments that a later stage is feasible without revision.

## M0 — Reproducible host companion

Status: implemented locally in 0.1.1.

- Prepare and independently decode both restricted SOL fixture forms.
- Export a fixed public-key profile 0 envelope; invalidate stale review state.
- Verify bound result records and reject modified inputs and signatures.
- Reproduce both outputs using pinned actual firmware and an isolated emulator
  build, with independent OpenSSL comparison.
- Document limits and publish the command needed to repeat the evidence.

Remote CI status must be checked separately after the repository is published.

## M1 — Restricted on-device SOL policy

Status: not implemented by this project.

Completion requires an independently reviewed 65C02 parser that accepts exactly
the agreed canonical transfer forms; positive and adversarial vectors; trusted
review of the complete recipient and amount; integration with the device's
confirmation/reset/fault state machine; and measured ROM, RAM and stack budgets.
Host checks must not be counted as satisfying this milestone.

The next proposed contribution is a small parser scope with explicit reject
vectors and resource accounting, agreed with upstream before broad changes.

## M2 — Squads composite transaction proof

Status: design and compatibility work outstanding.

Pin program and IDL versions. Establish exact account permissions, PDA
derivations and serialized size for the spec's proposed atomic sequence:
nonce advance, restricted vault-transaction creation, proposal creation and
the DTS member's first approval.

Execute that exact transaction on a local validator. Demonstrate success,
competing proposal behavior, changed nonce behavior, replay rejection and every
unsupported operation's rejection. A host-supplied snapshot of an existing
proposal is not sufficient evidence for the offline signer.

If the composite does not fit transaction or device constraints, document the
failure and revise the design rather than claiming integration.

## M3 — Physical public-key developer kit

Status: not built or measured by this project.

An embedded/electronics engineer must implement and inspect the independent
wipe/readback circuit, CPU and secret-input isolation, output restriction and
power/reset behavior. Measure signing time, electrical timing, discharge and
back-power behavior, interruption handling and manual-input usability on real
hardware. Publish setup, board revision and measurement method.

## M4 — Independent review and controlled pilot

Status: gated on prior milestones and licensing clarification.

Complete independent firmware/hardware review; reproducible ROM and readback;
component provenance; custody and recovery procedures; and a scoped pilot with
documented findings. No live-key product claim before those results exist.

## Commercial and token decisions

Potential commercialization and a separate token remain undecided. A token is
not required by the current fixture workflow and none is implemented. Any
future proposal must specify an actual role, obligations and implementation
status separately from the hardware roadmap. Upstream attribution is not an
endorsement of a product or token.
