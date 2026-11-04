# Browser acceptance — current scope

Current 0.3.0 evidence: [run 41816685541](https://github.com/TheTradoor/dts-console/actions/runs/41816685541)
passed 26/26 cases. All 38 screenshots and 26 diagnostic attachments were reviewed.
See [the validation record](VALIDATION.md) for source hashes, exported-file checks,
artifact integrity and the precise browser/validator limitations.

Version 0.3.0 extends the fixture suite with Squads draft construction, export/import, input invalidation, manual stale-state checks and rejected replacement imports. There are 26 Chromium cases across desktop and mobile viewports. Current results are recorded in the PR; the detailed 0.2.0 evidence below remains historical and is not evidence for changed 0.3.0 assets.

# Browser acceptance automation

Status: all 18 cases passed in [GitHub Actions run 41810704326](https://github.com/TheTradoor/dts-console/actions/runs/41810704326)
for head `a84b34be157c7b8e611aff267bafdceac6b46ae5`. All 28 archived screenshots
were visually inspected. Direct preview checks and an authenticated published-site
smoke check were completed separately; see [VALIDATION.md](VALIDATION.md).

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
report, downloaded JSON, screenshots, and traces for failed tests. Captures wait
up to ten seconds for the application's five-second notification to expire;
they do not hide overlays or alter the page for the screenshot. Every scenario
has visual evidence, including modified records and malformed imports. The HTML
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
