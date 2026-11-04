# Upstream relationship

Upstream: https://github.com/aeyakovenko/dts02-6502-signer

Pinned revision: a7cbac2ed7093a3cd994c4b7f1109396cd1d2faf.

DTS Console is a separate host-side development project. The bridge executes
the existing signing firmware without changing it. Every required upstream
source file has a SHA-256 pin in ../upstream-lock.json and is fetched separately.

## Alignment with the published direction

The intended long-term use follows the specification's distinct third offline
signer for a Solana/Squads treasury. The minimal device, manual review and narrow
authorization policy are central constraints. This companion makes public
fixtures easier to inspect and reproduce; it does not add an online stack to
the signer or claim to replace its trusted interface.

This interpretation comes from the published specification, not private
approval from the author. The exact implementation scope needs discussion.

## Questions worth asking the maintainer

1. Is a separate host companion for public fixtures useful within the intended
   scope, while keeping the signing core and device interface minimal?
2. Would the most useful next contribution be a tightly scoped on-device SOL
   parser with reject vectors and resource accounting, or a different blocker?
3. Is the proposed atomic Squads creation-and-first-approval flow still the
   intended integration target before validator work begins?
4. What license and attribution terms are intended for downstream reuse and
   potential commercial firmware or hardware distribution?

No answer is assumed. Attribution, previous contributions and a maintainer's
reply must not be represented as product or token endorsement.

## Contribution policy

Keep the companion in its own repository. Offer upstream changes as narrow,
reviewable fixes or tests with a concrete reproduction and explicit limits.
Do not submit the entire product wrapper as an unsolicited upstream feature.
Keep the pinned revision stable until an update is reviewed and fixtures are
reproduced; record any resulting output or resource changes.

## Licensing boundary

No explicit upstream license was identified in the reviewed revision. Public
visibility alone does not settle downstream distribution or commercial rights.
The Console's MIT license covers its original code only. DTS source is neither
vendored nor included in the downloadable kit; see ../NOTICE.md.
