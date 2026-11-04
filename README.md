# DTS Console

A development companion for [DTS-02](https://github.com/aeyakovenko/dts02-6502-signer).
Prepare canonical Solana transfer fixtures, inspect the exact message bytes,
run the pinned 65C02 signing firmware locally, and verify its output in a browser.

**Version 0.2.0 is a public-test-key prototype.** It includes the existing host
workflow and an opt-in experimental 65C02 parser for two restricted SOL message
forms. Trusted on-device review and authorization, physical hardware and Squads
integration remain engineering milestones. It accepts no private key and has
no wallet connection, RPC endpoint or broadcast operation.

The 0.2.0 UI identifies the experimental parser as partial M1 work and keeps
trusted device authorization separate from host-side review. The
[browser acceptance suite](docs/BROWSER_AUTOMATION.md) passed all 18 cases in
Chromium desktop and mobile viewports. The same commit passed the 51-test
firmware/host suite and four complete signing reproductions.

The development preview was also exercised and visually inspected on desktop
and in a 390-by-844 CSS frame. Review of the separate CI screenshot archive
remains pending, so the UI pull request stays draft. See the
[validation record](docs/VALIDATION.md) for exact runs, source hashes and limits.

This is an independent project. It does not claim endorsement by Anatoly
Yakovenko, Solana, or Squads.

## What works today

| Component | Implemented behavior |
| --- | --- |
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

Open http://localhost:8080, choose **Load signed example**, review the fields,
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

## Reproduce the evidence

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
shipping derivative firmware or hardware. See [NOTICE.md](NOTICE.md).

The browser uses pinned Noble 2.4.0 modules with strict Ed25519 verification
(zip215: false). It also cross-checks with WebCrypto when available. Fonts are
requested from Google Fonts; this packaged UI is not strictly network-isolated.
