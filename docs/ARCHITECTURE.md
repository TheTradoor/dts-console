# Architecture

The Console supports public fixture development. The browser and local Python
bridge run on the same assumed-trusted development host. Neither is a substitute
for an offline device's trusted display or authorization parser.

```mermaid
flowchart TD
  A[Browser preparation] --> B[Frozen session]
  B --> C[Python host validation]
  C --> D[Pinned firmware emulator]
  D --> E[Result record]
  B --> F[Browser verification]
  E --> F
```

## Components

| File | Responsibility |
| --- | --- |
| dist/protocol.mjs | Exact amount conversion, base58, canonical messages, envelope and result validation |
| dist/crypto.mjs | Hashing and strict Ed25519 verification; optional WebCrypto cross-check |
| dist/app.mjs | Prepare/review/verify state, file import/export, review-page coverage |
| tools/sign_fixture.py | Independent Python host parser, pinned firmware execution, OpenSSL comparison |
| tools/fetch_upstream.py | Fetch twelve files at one upstream revision and verify their hashes |
| tools/verify.py | Run tests and reproduce both recorded firmware outputs without replacing them |
| upstream-lock.json | Commit and per-file source hashes |

## Boundaries

| Boundary | Checked here | Remaining assumption |
| --- | --- | --- |
| Form to session | Canonical layout and exact integer amount | Browser and delivered JavaScript are trustworthy |
| Imported session to bridge | Independent byte parser, metadata/hash/envelope equality, fixed test key | Python process, compiler, OpenSSL and host are trustworthy |
| Fetched source to execution | Every imported source file matches its pin; native library rebuilt in a temporary directory | Pins were reviewed; host tooling and Python import environment are trustworthy |
| Result to browser | Format, binding and strict signature verification | A valid public test-key signature does not prove device provenance |
| Emulator to physical device | No physical claim is made | Actual isolation, erasure, timing and fault behavior need hardware measurement |

## Session lifecycle

Preparation serializes the transaction once and decodes those bytes for review.
The user must visit every recipient page before acknowledging and exporting.
Changing preparation fields clears the prepared session and verification state.
Generation counters prevent older asynchronous preparation or verification
results from replacing newer UI state.

This is an interaction safeguard on the development host. A malicious host can
replace the entire interface. A future device must independently decode and
display the same bytes it signs.

## Dependencies and network use

The static interface makes no chain or wallet calls. It reads bundled fixture
JSON and vendored crypto modules. Google Fonts is the only deliberate external
UI resource; block or self-host it for a fully offline development copy.

The source-fetch tool accesses raw.githubusercontent.com. npm is needed only to
rebuild vendored modules. The existing lockfile pins versions and registry
integrities. There is no backend, account system, seed collection, or telemetry.

Result evidence fields describe the local bridge run but are not signed hardware
attestations. The browser verifies the record itself and does not trust evidence
booleans as proof of any security property.
