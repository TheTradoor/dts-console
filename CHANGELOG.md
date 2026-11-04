# 0.3.3 — Paper interface and motion

- Rebuilt the overview around a light monochrome frame, hatched dividers and an illustrative session editor.
- Added progressive text/code entrances, subtle section transitions, a locally rendered point landscape and drifting fog.
- Added pause/resume and system reduced-motion support; decorative rendering stops outside the overview and while offscreen.
- Applied the matching light palette to the existing transaction workspace without changing signing or verification behavior.
- Added browser checks for changing canvas pixels, pause/resume, reduced motion and session preservation.

# 0.3.2 — Monochrome workspace

- Replace the colored glow with a black-and-white technical interface.
- Add a labeled workflow schematic, instrument-style dividers and squared controls.
- Apply neutral status treatments throughout; labels and symbols retain their meaning.
- Preserve all transaction, signing and draft behavior.

# 0.3.1 — Console design update

- Add an overview with a mint glow, workflow entry points and explicit developer-preview scope.
- Restyle all workspace views with dark surfaces, violet controls and responsive layouts.
- Replace the physical-device illustration with a software message preview.
- Support browser back/forward navigation, direct view links, keyboard focus and reduced motion.
- Retain public-fixture signing and unsigned Squads behavior; no wallet, RPC or broadcasting is added.
- Extend browser acceptance to 30 desktop/mobile cases, including overview navigation and session preservation.

# 0.3.0 — Unsigned Squads preparation

- Add a software-only Squads draft workspace: restricted nonce/create/propose/approve composition, derived accounts, exact-byte review and JSON import/export.
- Detect manual nonce/index mismatches and invalidate changed or rejected drafts.
- Add a pinned SDK serialization oracle, 128 differential vectors and browser acceptance coverage.
- Correct product scope and roadmap to exclude physical hardware development.
- Keep the existing public-key signing bridge unchanged; Squads signing, chain-state verification and execution remain pending.

# Changelog

## 0.2.0 — proposed, 2026-11-04

- Add an original 65C02 parser for the two canonical public SOL fixture forms.
- Add an opt-in `--firmware-policy` build that checks the locked message before
  the first signature. Default upstream firmware and baseline results remain
  unchanged; profiles 1/2 stay disabled.
- Compare 5,803 deterministic vectors across firmware, JavaScript and Python;
  check all u16 declared lengths, unknown profiles, expected keys, frozen-input
  binding, invalid latch states and locked-bank write faults.
- Trace selected parser paths on both CPU implementations and record ROM,
  scratch and parser-call stack use. Reproduce four full signing runs and
  compare with OpenSSL.
- Reject cached upstream imports from a different checkout. Include the
  original assembly and new references in the development kit.
- Document the partial M1 scope and pending trusted review, boot/recovery,
  independent review, Squads and hardware work.
- Propose matching 0.2.0 browser version/readiness text and an exported-report
  limitation that identifies missing trusted device review and authorization.
  Record direct browser checks and a passing 18-case Chromium CI run.
- Run browser acceptance in GitHub Actions with fixture imports, downloads,
  stale-state rejection and desktop/mobile viewport configurations. Review all
  28 CI screenshots and record authenticated published-site checks.
- Wait for transient notifications to expire before capturing screenshots;
  include modified-record and malformed-import states in the visual evidence.
- Show REJECTED for malformed result JSON and add a regression scenario.

## 0.1.1 — 2026-11-04

- Correct source hashes to match raw upstream bytes and pin the full import
  closure. Preserve both firmware output fixtures.
- Reject boolean false as profile 0 at the Python session boundary.
- Add reproducible verification, CI and a deterministic source kit.
