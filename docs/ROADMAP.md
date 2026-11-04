# Software roadmap and acceptance criteria

DTS Console builds software. Hardware design, assembly, manufacturing and device
sales are excluded. Earlier physical-kit and hardware-pilot milestones are
superseded by this scope; external signer requirements remain documented as limits.
Milestones describe evidence, not release dates or claims of production safety.

## P0 — Product-fit decision before further expansion

Current priority, 4 November 2026. Hold treasury feature expansion while the
product's recurring user need and core dependency on DTS are unresolved. Keep
the existing release, source and validation records available.

The initial assessment found that public-fixture reproduction actually executes
DTS firmware, while unsigned Squads drafting works without that execution.
The published upstream design's physical security properties cannot be claimed
for a software emulator. Neither finding proves that every possible software
product using DTS is unsuitable.

Use the existing fixture workflow to evaluate a developer compatibility-tool
hypothesis. The walkthrough is prepared in PRODUCT.md. Gather concrete task feedback through
authorized outreach, and record the explicit continue/stop criteria in
[PRODUCT.md](PRODUCT.md#immediate-validation-work). No interviews or demand
validation have been completed. A developer audience is a candidate, not a
replacement product decision already made for the owner.

S2-S4 remain conditional technical acceptance criteria. They do not by themselves
clear P0, and passing them would not establish demand or a security advantage.

## S0 — Reproducible DTS companion

Implemented in 0.1.1 and retained in later releases: prepare restricted public
fixtures, review frozen bytes, export/import sessions, reproduce actual pinned
firmware output in an emulator and independently verify Ed25519 signatures.
The existing firmware/host verification covers 51 tests, 5,803 differential
vectors, every u16 message length and four complete signing reproductions.

The optional 0.2.0 65C02 parser experiment remains partial under the historical
M1 designation. It adds a pre-sign policy gate but no trusted device approval.
Further device confirmation/reset work is external signer research, not the
Console's next product milestone.

## S1 — Unsigned Squads preparation and review

Implemented in 0.3.0 for one restricted SOL transfer: legacy outer message,
durable nonce advance, vault transaction creation, active proposal creation and
one approval. One member also pays fees/rent and owns the nonce authority role.
No memos, lookup tables, ephemeral signers, alternate programs or execution.

Acceptance: exact SDK serialization/PDA agreement; integer boundaries; bounded
independent decoding; rejection of malformed bytes and mismatched metadata;
reviewed JSON export/import; stale draft invalidation; comparison of explicitly
unverified index/nonce inputs; desktop and mobile browser checks.

A prepared draft is not a signature or a completed Squads integration. The
current DTS bridge must continue rejecting this unsupported message language.

## S2 — Local-validator execution proof

On hold pending P0. Pin program source, IDL and deployed test binary. Execute the
exact S1 composite in a local validator with public test keys and a 2-of-3 configuration.
Verify account owners, permissions, proposal linkage and first approval.

Required adversarial cases: another member creates the next transaction first;
the nonce changes before submission; and a consumed nonce is replayed. In each
case record vault transaction, proposal and approval state plus fees and nonce
consumption. A size calculation or SDK match does not satisfy this gate.

## S3 — Read-only treasury workflow

On hold pending P0. Retrieve and validate multisig configuration and nonce state;
show data origin, slot/commitment and retrieval time. Detect unsafe thresholds, permissions,
configuration authority and spending-limit paths. Re-read before an external
submission step; changes require new bytes and review, never silent retries.

Acceptance includes simulated stale/conflicting snapshots and unavailable RPCs.
No imported host snapshot becomes trusted offline-signer authorization.

## S4 — Reviewed software pilot

On hold pending P0. Independent review of the complete software flow, reproducible
builds, compatibility evidence and explicit limits. Any future external signing adapter
must preserve the signer boundary. Real-key handling or production execution is
not enabled by the draft composer or the current profile-0 emulator.

## External dependencies and product decisions

Upstream device security is tracked separately; no Console hardware build is
scheduled. Attribution and downstream distribution terms require resolution.
A token is not necessary for the existing workflow and none is implemented.
