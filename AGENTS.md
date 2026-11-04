# DTS Console project direction

Build a software product using DTS-02 for Solana transaction preparation,
review, compatibility testing and signature verification. Keep the published
DTS-02 design and trust boundaries explicit. Do not claim upstream endorsement.

Physical hardware, PCB design, electronics assembly, manufacturing and hardware
sales are outside the product scope. Do not turn upstream device requirements
into Console hardware milestones. This constraint also applies to future work.

The reference productization pattern is percolator.trade: useful software
workflows and integrations around an upstream foundation. A UI wrapper alone
does not establish a completed treasury product or a token's utility.

The current firmware bridge accepts public test keys and restricted SOL fixtures
only. Squads drafts are unsigned, unsubmitted and not accepted by that bridge.
Keep draft construction, SDK compatibility, validator execution, external
signing and physical signer security as separate claims with separate evidence.

Follow docs/ROADMAP.md for the next software acceptance gates. Keep exact source
pins and evidence; never describe a passing byte-comparison test as on-chain
execution or a signature as proof of trusted authorization.
