# Supported formats

All messages are public fixtures. No arbitrary Solana instruction, versioned
message, address lookup table or multi-signer message is accepted.

## Canonical legacy messages

| Property | SOL transfer | Durable-nonce advance + transfer |
| --- | --- | --- |
| Serialized bytes | 150 | 224 |
| Header | 1 required signer, 0 readonly signed, 1 readonly unsigned | 1 required signer, 0 readonly signed, 2 readonly unsigned |
| Account order | Test signer; recipient; System Program | Test signer; nonce account; recipient; RecentBlockhashes sysvar; System Program |
| Instructions | System transfer from account 0 to 1 | Advance nonce using accounts 1/3/0, then transfer from account 0 to 2 |
| Authority | Published test signer | Published test signer is nonce authority and transfer source |

The System Program is the all-zero 32-byte key. Instruction data is little
endian: transfer discriminant 2 followed by a u64 lamport amount; nonce advance
discriminant 4. Compact-u16 lengths must use their shortest representation.
Duplicate keys, unexpected permissions, zero amount and trailing bytes fail.

Amounts are serialized from integer lamports, with at most nine decimal places
when entered as SOL. The JavaScript implementation uses BigInt.

## Session JSON

Schema: dts-console-session-v1. Network: fixture-only. Profile: numeric zero.

The session includes upstreamCommit, expectedPublicKeyHex, messageHex,
messageSha256, messageSha512, envelopeHex and review. The parser reconstructs
review from the exact message and checks its values, hashes and envelope.
Review metadata is not an authorization source. Optional fixtureNonceAccount
is a UI convenience and is not trusted by the signing policy.

Hex-encoded message bytes are lowercase and bounded to 1,167 bytes. The current
allowlisted forms are smaller and must match their exact layouts.

## Input envelope

| Offset | Bytes | Meaning |
| --- | --- | --- |
| 0 | 8 | ASCII DTS02IN1 |
| 8 | 1 | Profile 0 |
| 9 | 1 | Reserved; zero |
| 10 | 2 | Message length, little endian |
| 12 | 32 | Published test public key |
| 44 | N | Message bytes |
| 44 + N | 4 | CRC-32 over all preceding envelope bytes, little endian |

## Public result record

Schema wrapper: dts-console-result-v1. sessionSha256 identifies the prepared
message; recordHex contains exactly 256 bytes.

| Offset | Bytes | Meaning |
| --- | --- | --- |
| 0 | 8 | ASCII DTS02OUT |
| 8 | 1 | Version 1 |
| 9 | 1 | Profile 0 |
| 10 | 2 | Message length, little endian |
| 12 | 32 | Public key |
| 44 | 64 | Ed25519 signature over the message |
| 108 | 64 | SHA-512 of the message |
| 172 | 4 | CRC-32 over bytes 0–171, little endian |
| 176 | 80 | Reserved; all zero |

Verification checks every format constraint and binding before accepting the
signature. Strict Ed25519 verification rejects noncanonical signatures.
The evidence object reports a local run's checks; it is not trusted by the
browser and is not hardware attestation.

The optional firmware parser build keeps the same profile-0 record format.
Its evidence adds `firmwareParser` resource/source hashes and
`preSignPolicyGate: true`. `onDevicePolicyImplemented` stays false because
trusted device review, confirmation and complete recovery are not implemented.
These unsigned fields are descriptive and never override signature checks.
