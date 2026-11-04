# Browser validation procedure for the proposed 0.2.0 UI update

Status: the functional checklist passed in the 18-case Chromium CI run,
and all 28 archived screenshots were visually inspected. Direct preview checks,
desktop/narrow CSS-frame inspection and authenticated published-site smoke
checks also passed. Browser acceptance is complete for this recorded scope.
See [the validation record](VALIDATION.md) and its machine-readable evidence.
The procedure below is retained for subsequent changes.

Run these checks on the UI proposal's exact commit in an authorized browser
environment. Record the commit, browser/version, viewport, date, observed
results and screenshots. Do not infer success from a test script, this document
or the independent CLI verification result.

All inputs below are checked-in public fixtures. No wallet, RPC, user seed,
funded account, blockchain submission or external service is required.

## Readiness and version

Open Build readiness. The proposed UI should show version 0.2.0 and identify
the experimental parser as M1 partial. Trusted device review/approval and
physical hardware must remain described as outstanding. The displayed test
total and date must match dist/validation.json, rather than a hard-coded total.

Check Prepare and Review as well. Their help text must continue to identify
the device display as a preview and the workflow as public-test-key only.

## Verify both actual-firmware records

Use Import session, open Review session to inspect the imported fields, then
open Verify result and Choose result file for each pair:

| Session | Result | Expected |
| --- | --- | --- |
| dist/fixture-session.json | dist/policy-fixture-result.json | VERIFIED; 0.000005 SOL; recipient matches the session |
| dist/nonce-fixture-session.json | dist/policy-nonce-fixture-result.json | VERIFIED; amount and recipient match the nonce session |

After each import, first confirm that the review fields identify the intended
session. A visible result from the previous import must not satisfy this step.

Download the verification report for each result. Confirm verified=true, the
message hashes/signature match the source fixture and the limitations include
"No trusted device review or authorization". Descriptive firmware evidence
must not be copied into the report as a verified hardware-security claim.

With the nonce session still selected, import policy-fixture-result.json.
Expect REJECTED with the different-session message, no successful result panel
and no enabled download of the previous verified report.

## Review gate and stale state

Import fixture-session.json again. Export must be disabled before all four
recipient pages have been visited and the acknowledgement is checked. After
those steps, export and confirm the downloaded session preserves the exact
message bytes and integer lamports.

Return to Prepare, select the legacy transfer format and set the recipient to
fixture-session.json's recipient. Importing a session does not populate the
Prepare form, so check those inputs explicitly. Set the amount to 0.000006 SOL
and prepare the new session. Review coverage and acknowledgement must reset.
Importing the old result must be rejected. Merely editing fields must not leave
an old verified result available for download.

## Rendering and interaction

Inspect Readiness and Verify at a normal desktop viewport and a 390-by-844
mobile viewport. Check that controls remain usable, status text wraps clearly,
no content overlaps, and the document has no horizontal overflow. Exercise the
actual file pickers and download controls. Record JavaScript errors separately
from failed external font requests.

## Record the outcome

Record each expected result as pass/fail with its observation. Include failures
and unexecuted steps. Keep the UI proposal draft if any required step is still
unverified. Update docs/VALIDATION.md only after results exist; a successful UI
review still does not establish on-device authorization, hardware safety or
Squads execution.
