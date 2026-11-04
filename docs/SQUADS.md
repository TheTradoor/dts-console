# Squads unsigned draft contract

Version 0.3.0 adds offline preparation, not signing or on-chain execution.
The design follows DTS-02 spec section 10.5 at upstream revision
`a7cbac2ed7093a3cd994c4b7f1109396cd1d2faf`.

## Pinned references

- Squads source: `Squads-Protocol/v4` at `af94153ff77a28b6effe46b9c94baaa93742b48c`.
- IDL path: `sdk/multisig/idl/squads_multisig_program.json`; Git blob
  `ae557d203e289cba755ff4a8f9d59fd2f5beebbe`.
- Test oracle: `@sqds/multisig` 2.1.4 and `@solana/web3.js` 1.98.4;
  package integrity and transitive versions are locked in `package-lock.json`.
- Program: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`.

These pins define a serialization reference. They do not attest the program
binary currently deployed to any cluster. Source and deployed binary verification
are part of the local-validator/chain-integration work still outstanding.

## Accepted form

| Part | Supported value |
| --- | --- |
| Outer format | Legacy message; one required signature; eight unique accounts |
| Instruction 1 | System durable nonce advancement |
| Instruction 2 | Squads vault transaction creation with one inner System SOL transfer |
| Instruction 3 | Active proposal creation at current transaction index + 1 |
| Instruction 4 | First approval by the same member |
| Member roles | Fee payer, rent payer, creator, approver and nonce authority are the same public key |
| Amount | Positive u64 lamports, parsed with BigInt; at most nine SOL decimal places |
| Current index | Decimal integer 0 through 9007199254740990; matches the pinned SDK's safe-integer limit |
| Vault index | 0 through 255 |
| Unsupported | Memos, address lookup tables, ephemeral signers, token transfers, extra programs/instructions, execution |

The member address must decode as an Ed25519 point, and the supplied multisig
address must be off-curve. These checks do not prove account existence, ownership,
membership or permissions. All supported recipient/control roles must be distinct.
Vault, transaction and proposal addresses are derived from the supplied multisig,
index and fixed program ID. The multisig itself is not authenticated.

The inner Squads message has u8 account/instruction counts, u16 instruction data
lengths, and no recent blockhash. The outer legacy message contains the nonce.
Every accepted form is 487 message bytes, or 552 transaction bytes including a
one-byte signature count and one 64-byte signature slot. No signature is produced.

## Review and import

`dist/squads.mjs` implements the narrow encoder and a separate bounded decoder.
The review is reconstructed from the serialized bytes. The decoder checks
instruction discriminators, order, account permissions, PDA linkage, full inner
transfer, exact lengths and canonical encoding. JSON import recomputes the hash
and rejects changed review fields, source references, status or limitations.

The JSON format is `dts-console-squads-draft-v1`, always `UNSIGNED_DRAFT`.
It contains the message hex, SHA-256, decoded review, source references and limits.
A hash detects changes; it does not authenticate the author or chain state.
It is deliberately not a `dts-console-session-v1` signing envelope. The existing
DTS bridge and firmware policy remain restricted to their original SOL fixtures.

Any preparation-input edit or failed replacement import clears the previous
review and disables export. Full-address review acknowledgement is required for
export. The manual comparison tool marks changed index/nonce values as
`REBUILD_REQUIRED` and prevents reuse of that draft. `VALUES_MATCH` explicitly
means only the entered values match; it never means safe, authorized or fresh.

## Validation

`npm ci --ignore-scripts` installs the pinned test dependencies.
Run `npm run test:squads`: 128 deterministic differential vectors cover exact SDK
bytes and all three PDA derivations across amount/index boundaries and vaults.
A checked-in example is independently generated with the official SDK. Negative
tests include every truncated prefix, extra bytes, permissions, control-account
changes, metadata tampering, unsafe integer inputs and stale-state comparison.

Browser tests exercise example construction, reviewed export/import, invalid
input/import replacement, stale-state handling and mobile layout. Exact CI runs
and any incomplete checks are recorded in the PR and validation notes.

## Remaining execution work

The composer does not fetch RPC state, verify 2-of-3 configuration, produce an
approval, charge rent/fees or submit anything. It does not prove signature safety.
Local-validator testing must establish nominal and adversarial execution,
including competing transaction creation, nonce advancement and replay, and must
record actual fee/nonce/account outcomes before claiming Squads integration.

The product remains software-only. Upstream hardware requirements are external
signer constraints and are not part of the Console delivery plan.
