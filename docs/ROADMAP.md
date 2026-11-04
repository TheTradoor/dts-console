# Roadmap and acceptance criteria

Milestones describe engineering evidence required for progress. They are not
release dates or commitments that a later stage is feasible without revision.

## M0 — Reproducible host companion

Status: implemented in 0.1.1; retained in 0.2.0.

- Prepare and independently decode both restricted SOL fixture forms.
- Export a fixed public-key profile 0 envelope; invalidate stale review state.
- Verify bound result records and reject modified inputs and signatures.
- Reproduce both outputs using pinned actual firmware and an isolated emulator
  build, with independent OpenSSL comparison.
- Document limits and publish the command needed to repeat the evidence.

The published 0.1.1 baseline passed [remote CI](https://github.com/TheTradoor/dts-console/actions/runs/41786675460).
Every later change needs its own successful run.

## M1 — Restricted on-device SOL policy

Status: partial in 0.2.0. An experimental profile-0 parser and pre-sign gate run
on the emulated 65C02. Trusted review/confirmation and the complete device
reset/fault state machine remain unimplemented; independent review is pending.

Completion requires an independently reviewed 65C02 parser that accepts exactly
the agreed canonical transfer forms; positive and adversarial vectors; trusted
review of the complete recipient and amount; integration with the device's
confirmation/reset/fault state machine; and measured ROM, RAM and stack budgets.
Host checks must not be counted as satisfying this milestone.

See [FIRMWARE_POLICY.md](FIRMWARE_POLICY.md) for the exact accepted language,
5,803 differential vectors, all-u16-length checks, bus tracing and measured
resource use. Two complete parser-enabled signing runs preserve the baseline
records. These results do not complete M1 or enable a live-key profile.

The next steps are independent review and a trusted review/confirmation state
machine, followed by full reset/fault integration and combined resource
accounting. Discuss the narrow parser proposal with upstream before proposing
changes to its production profile or architecture.

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
