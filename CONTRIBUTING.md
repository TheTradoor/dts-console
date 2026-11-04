# Contributing

Start with a reproducible issue and keep changes focused. Describe the input
that triggers the problem, current behavior, expected behavior and the trust
boundary affected. Use only published or synthetic test keys.

Before a pull request:

    python3 tools/verify.py --fetch-upstream --report artifacts/validation.json

Add a meaningful rejection or acceptance case when changing parsing,
cryptography or session binding. For UI changes, exercise the changed workflow
in a browser and include the tested browser and steps. Do not claim hardware
or on-chain validation from emulator results.

Keep immutable amounts as integer lamports. Decode the frozen bytes for review;
do not substitute display metadata for message parsing. Preserve state
invalidation when preparation inputs change.

Dependency updates must keep exact versions, license notices and a reviewed
vendor diff. Upstream changes require new per-file hashes and explicit fixture
comparison. Do not regenerate reference outputs merely to make a failing test
pass; explain why the output changed.

AI assistance does not replace understanding or validation. The contributor
remains responsible for every claim and the submitted code.

Please read SECURITY.md before reporting a vulnerability. Never include seed
phrases, real private keys, access tokens, personal data or private treasury
transactions in issues, tests or logs.
