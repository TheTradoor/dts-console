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
- Retain the 0.1.1 browser HTML and application script unchanged. The proposed
  UI wording update is a separate change with browser QA outstanding.

## 0.1.1 — 2026-11-04

- Correct source hashes to match raw upstream bytes and pin the full import
  closure. Preserve both firmware output fixtures.
- Reject boolean false as profile 0 at the Python session boundary.
- Add reproducible verification, CI and a deterministic source kit.
