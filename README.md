# DTS Console

A development companion for [DTS-02](https://github.com/aeyakovenko/dts02-6502-signer).
Prepare canonical Solana transfer fixtures, inspect the exact message bytes,
run the pinned 65C02 signing firmware locally, and verify its output in a browser.

**Version 0.3.3 is a software development prototype.** It includes the existing host
workflow and an opt-in experimental 65C02 parser for two restricted SOL message
forms. The new Squads draft workspace prepares and reviews an unsigned composite.
On-chain Squads execution remains pending; trusted device authorization belongs
to the external signer. Hardware development is outside this project’s scope. It accepts no private key and has
no wallet connection, RPC endpoint or broadcast operation.

Version 0.3.3 adds a light monochrome interface, an illustrative code preview,
progressive entrance animations and a decorative point landscape with pause/resume
and reduced-motion support. Its [browser acceptance suite](docs/BROWSER_AUTOMATION.md)
contains 34 cases across desktop and mobile viewports. Current and historical
evidence are separated in the [validation record](docs/VALIDATION.md).

This is an independent project. It does not claim endorsement by Anatoly
Yakovenko, Solana, or Squads.

## Software product scope

No PCB, physical device, assembly or manufacturing is planned. The Console
builds usable preparation, review and verification workflows around DTS-02.
The new **Squads draft** tab constructs the spec’s proposed nonce/create/propose/
approve message, shows independently decoded intent and exports unsigned JSON.
It cannot be signed by the current DTS bridge or submitted from the Console.
See [the Squads contract](docs/SQUADS.md) and [software roadmap](docs/ROADMAP.md).

## What works today

| Component | Implemented behavior |
| --- | --- |
| Squads draft | Unsigned restricted SOL proposal composition, PDA derivation, byte review, JSON import/export and manual stale-state comparison |
| Prepare | Canonical legacy SOL transfer and durable-nonce advance + transfer fixtures |
| Review | Decode frozen bytes, show exact integer amounts and all recipient pages; invalidate state when inputs change |
| Export | Profile 0 envelope with the published RFC 8032 test public key |
| Firmware bridge | Execute pinned upstream firmware on its C emulator with double signing and verification |
| Experimental firmware parser | Check frozen SOL bytes on the emulated 65C02 before signing; fixed public test key and profile 0 only |
| Verify | Check record format, CRC, public key, message length, SHA-512 binding, and Ed25519 signature |
| Reproduce | Differential parser tests, memory/stack checks and four full signing runs compared with checked-in results |

Browser review and the Python parser are **host-side checks**. The experimental
assembly parser adds a firmware check but does not provide trusted review or a
complete authorization state machine. DTS profiles 1/2 remain disabled.

## Try the interface

No npm install is needed for the prebuilt interface:

    python3 -m http.server 8080 --directory dist

Open http://localhost:8080 and choose **Open workspace**. Select **Squads draft → Load test draft**
for unsigned preparation. For the DTS signing example, choose **Load signed example** in Prepare, review the fields,
then select **Verify signed example** in the Verify view. This checks a recorded
emulator result. Signing does not run in the browser.

To make a new fixture, prepare a transfer, inspect every recipient page,
acknowledge the review, and export the session. Then run:

    python3 tools/fetch_upstream.py
    python3 tools/sign_fixture.py dts-session.json --output dts-result.json

Import that result into the Console. The test seed is published and must never
hold funds. Blockhashes and nonce accounts are fixture values; these are not
live-chain transactions.

To exercise the experimental parser before signing the same public fixture:

    python3 tools/sign_fixture.py dts-session.json --firmware-policy --output dts-policy-result.json

The signed record is unchanged. The optional build performs additional checks
on the frozen message before it reaches signing. See the
[firmware policy design and limits](docs/FIRMWARE_POLICY.md). M1 remains partial.

## Squads compatibility checks

    npm ci --ignore-scripts
    npm run test:squads

The narrow browser codec is compared byte for byte with the pinned official SDK
across 128 deterministic vectors. SDK dependencies are used for tests only and
are not bundled into the browser. No private key or RPC is needed.

## Reproduce the firmware evidence

On Linux with Node 24, Python 3.10+, cc, and OpenSSL 3:

    python3 tools/verify.py --fetch-upstream --report artifacts/validation.json

This command verifies source pins, runs JavaScript and Python tests, executes
both fixtures with and without the experimental parser, and compares outputs. It does not
overwrite the checked-in fixtures. The same command is configured in
[GitHub Actions](.github/workflows/verify.yml); a workflow file alone is not
evidence of a successful remote run.

See [reproduction instructions](docs/REPRODUCING.md) and the
[validation record](docs/VALIDATION.md) for exact scope and limitations.

## Project map

| Read this | For |
| --- | --- |
| [Product scope](docs/PRODUCT.md) | Intended users, current value, and release boundaries |
| [Architecture](docs/ARCHITECTURE.md) | Components and trust boundaries |
| [Formats](docs/FORMATS.md) | Supported messages, envelopes, and result records |
| [Experimental firmware policy](docs/FIRMWARE_POLICY.md) | Assembly ABI, accepted language, integration, resource budget and remaining M1 work |
| [Threat model](docs/THREAT_MODEL.md) | What is and is not covered |
| [Roadmap](docs/ROADMAP.md) | Milestones with observable completion criteria |
| [Upstream relationship](docs/UPSTREAM.md) | Attribution, open design questions, and contribution policy |
| [Contributing](CONTRIBUTING.md) | How to propose and validate changes |
| [Security](SECURITY.md) | Reporting a problem without sharing secrets |

## Source and licensing

Upstream is pinned to a7cbac2ed7093a3cd994c4b7f1109396cd1d2faf.
SHA-256 hashes for every fetched source file are recorded in
[upstream-lock.json](upstream-lock.json). DTS source is fetched separately and
is not redistributed in this repository or its kit.

Original Console code is provided under [MIT](LICENSE). Vendored Noble libraries
retain their own MIT notices. This grant does not apply to upstream DTS code.
Upstream licensing and commercial distribution rights need clarification before
distributing derivative firmware. Hardware is outside the product scope.
See [NOTICE.md](NOTICE.md).

The browser uses pinned Noble 2.4.0 modules with strict Ed25519 verification
(zip215: false). It also cross-checks with WebCrypto when available. Fonts are
requested from Google Fonts; this packaged UI is not strictly network-isolated.
