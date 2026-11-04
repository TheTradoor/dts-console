# Attribution and third-party notices

## DTS-02

DTS-02 is the upstream 65C02 signer project by Anatoly Yakovenko and its
contributors: https://github.com/aeyakovenko/dts02-6502-signer

The Console bridge uses a separately fetched, pinned revision. Upstream source
is not included in this repository or its generated kit. No explicit upstream
license was identified in that revision; do not infer commercial distribution
rights from the Console license. Clarification is an open project requirement.

This independent project is not represented as official, endorsed, audited or
approved by Anatoly Yakovenko, Solana or Squads.

## Noble cryptography libraries

The browser includes @noble/curves 2.4.0 and @noble/hashes 2.4.0. Copyright and
MIT notices are retained in dist/vendor/curves/LICENSE and
dist/vendor/hashes/LICENSE. The lockfile pins the packages used by the vendor
rebuild script. See dist/vendor/NOTICE.txt.

## Test vectors and outputs

Signing uses the published RFC 8032 Ed25519 test vector 1 seed. Fixture message
and result files are reproducible development data, not funded accounts or
hardware attestations. The bridge's emulated checks do not establish physical
security.

## Original work

The root MIT license applies to original Console code and documentation. It
does not relicense separately fetched upstream code or override retained
third-party notices.
