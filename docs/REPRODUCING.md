# Reproducing the results

## Environment

The reference environment is Linux with Node 24, Python 3.10 or newer, a C
compiler named cc and OpenSSL 3 with Ed25519 support. CI uses Ubuntu 24.04,
Node 24 and Python 3.12. Other platforms have not been validated.

The static interface and tests use checked-in crypto modules; npm install is
not required. Fetching the pinned upstream files requires Internet access.

## Full check

From the repository root:

    python3 tools/verify.py --fetch-upstream --report artifacts/validation.json

The runner checks all twelve upstream file hashes before importing source,
checks JavaScript syntax, runs both test suites, builds the native emulator
in a temporary directory for each fixture and executes the actual firmware.
This includes the assembly parser's differential corpus and length/profile,
bus-access, stack and integration tests. Both canonical fixtures run with the
baseline ROM and again with the experimental parser: four full signing runs.
It compares the complete JSON results, including record bytes, ROM hash,
cycles and check results, against the checked-in references.

The bridge retains double signing and firmware verification, checks both bank
locks, unchanged message bytes and cleared emulated scratch memory, then
compares and verifies the signature with OpenSSL.

A successful run writes the JSON report and adjacent TAP log. A failure exits
nonzero. Existing report files are not proof of a later failed run; check the
command's exit status and the report timestamp.

## Existing pinned checkout

To avoid downloading files again:

    python3 tools/verify.py --upstream /path/to/dts02 --report artifacts/validation.json

The checkout must contain the exact pinned file bytes. The bridge rebuilds
the emulator library, so an existing shared library is not reused.

## Individual checks

    DTS_UPSTREAM=/path/to/dts02 node --test tests/protocol.test.mjs
    python3 -m unittest discover -s tests -p 'test_*.py'
    python3 tools/sign_fixture.py dist/fixture-session.json --upstream /path/to/dts02 --output artifacts/fresh-result.json
    python3 tools/sign_fixture.py dist/fixture-session.json --upstream /path/to/dts02 --firmware-policy --output artifacts/policy-result.json

Python firmware tests need the pinned checkout too. Set DTS_UPSTREAM for a
non-default path; the full runner handles this for both test suites.

The full runner handles DTS_UPSTREAM automatically. Running npm test directly
requires that variable because the serialization comparison imports the
separate upstream Python builder.

## Intentional fixture regeneration

    node tools/generate-fixtures.mjs /path/to/dts02

This command overwrites the checked-in fixture sessions and results. Use it
only for an intentional reviewed change, inspect the diff and explain why the
reference changed. It is not the verification command.

Experimental references are generated explicitly with `--firmware-policy` for
dist/fixture-session.json and dist/nonce-fixture-session.json, writing
dist/policy-fixture-result.json and dist/policy-nonce-fixture-result.json. Their
recordHex fields must equal the existing baseline records. Only the ROM and
emulator evidence should change. Generated ROMs stay local and are not packaged.

## Rebuild dependencies or download kit

    npm ci
    node tools/vendor-crypto.mjs
    python3 tools/build_devkit.py

The first two commands are needed only when rebuilding the vendored crypto
modules. The last command creates dist/dts-console-devkit.zip, which supplies
the interface's developer-kit download. It includes source, documentation,
tests, original assembly, fixtures and dependency notices; it excludes fetched upstream source,
node_modules, credentials, runtime artifacts and hosting metadata.

## Limits

Reproduction establishes deterministic local execution for these inputs on
the tested host. It does not establish physical erasure, electrical isolation,
on-device authorization, on-chain execution or production custody readiness.
CI configuration is provided, but remote CI success must be verified from an
actual run after repository publication.
