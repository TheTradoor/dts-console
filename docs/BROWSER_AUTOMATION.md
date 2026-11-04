# Browser acceptance automation

Status: desktop interactions have been exercised through the development
preview. The full Playwright run and its screenshot review remain pending.
Test discovery and syntax checks do not establish that the suite passes.

The Playwright suite covers nine scenarios in two Chromium viewport
configurations (1440 x 1000 and 390 x 844). It checks readiness text, imports and
verification for both public fixtures, downloaded report contents, rejection of
cross-session and damaged results, review/acknowledgement gating, input edits,
and replacement with malformed session or result JSON. Readiness is opened
through the visible View scope control, including on mobile where the sidebar
shortcut is hidden.

## Setup

The runner expects a deployment of the checked-out `dist` directory. It has
no default URL and does not start a server or install browsers. The separate
`.github/workflows/browser.yml` workflow installs the locked dependencies and
Chromium in an isolated GitHub Actions runner, serves `dist` on the runner's
loopback interface and supplies that URL explicitly. It runs on pull requests,
pushes to main and manual dispatch, with read-only repository permissions.
Reports, screenshots and failure traces are retained as `browser-evidence`
artifacts for 14 days. The firmware workflow remains separate.

Playwright Test is pinned to 1.64.1. Dependencies can be installed without
package lifecycle scripts using `npm ci --ignore-scripts`. The execution
environment also needs the matching Chromium binary and its system libraries.

List the scenarios without running tests or starting a browser:

    npm run test:browser:list

Set `DTS_BROWSER_BASE_URL` to the review deployment's HTTP(S) base URL,
including its trailing slash, and run
`npm run test:browser`. The URL must not contain credentials, a query or a
fragment. An absent target causes execution to fail; it does not skip tests or
produce a passing report.

## Evidence and limits

The suite verifies entry-point asset hashes against the checkout before each
scenario. It exercises the real file chooser and download events, reads the
downloaded JSON, and compares the message binding and signature with the
checked-in fixtures. It records uncaught JavaScript errors, failed application
requests, browser version and viewport. Retries are disabled.

Outputs are written under `artifacts/browser/`: a JSON result file, an HTML
report, downloaded JSON, screenshots, and traces for failed tests. The HTML
report does not open automatically. The checkout commit and working-tree
status are recorded when Git metadata is available. Source hashes also
identify packaged checkouts without Git metadata.

External font requests are disabled. Screenshots therefore cover fallback
fonts, not the externally hosted font variant. Other external requests fail
the scenario. Mobile results describe Chromium viewport emulation, not a
physical phone or Safari. The geometry assertion checks horizontal overflow;
saved screenshots still require visual inspection for overlap and readability.

Only an actual completed run, with every expected scenario passing and its
screenshots reviewed, can close the corresponding acceptance checks. Record
that result in [VALIDATION.md](VALIDATION.md). Keep failed and unexecuted checks
visible. The existing 51-test firmware/host count does not include this suite.
