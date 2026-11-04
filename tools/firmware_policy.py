"""Build the experimental profile-0 parser extension from pinned upstream source.

The generated derivative ROM stays local. No production profile is enabled.
This adds parsing after MESSAGE_LOCK and before the first signing operation;
it does not implement trusted review, boot recovery or physical security.
"""
import hashlib
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE_ROM_SHA256 = "ed5a9da101906ca7b609f9a696daebcf93775ecd8ccf3304eae9e211b2c260ac"
POLICY_ID = "console-sol-parser-v1-public-fixtures"


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError("Pinned firmware integration point changed: " + old)
    return text.replace(old, new, 1)


def build(firmware, assembler):
    base_image, _, source = firmware.build(double_sign=True, verify=True)
    if hashlib.sha256(base_image).hexdigest() != BASE_ROM_SHA256:
        raise ValueError("Unexpected baseline signing ROM")
    policy = (ROOT / "firmware" / "sol_policy.s").read_text()
    source = replace_once(source, "STA $7F03\n", "\n".join([
        "STA $7F03", "JSR dts_policy_check", "BCC dts_policy_gate_ok",
        "JMP dts_policy_hold", "dts_policy_gate_ok:",
    ]))
    source = replace_once(source, ".org $FFFA\n.word reset, reset, reset", "\n".join([
        policy, "dts_policy_test: JSR dts_policy_check", "STP",
        "dts_policy_after_test:", ".org $FFFA", ".word reset, reset, reset",
    ]))
    image, symbols = assembler.assemble(source)
    if symbols["dts_policy_after_test"] > 0xFFFA:
        raise ValueError("Experimental ROM overlaps interrupt vectors")
    if firmware.ZP["SQJ2"] >= symbols["DTS_PTR"] or symbols["DTS_KIND"] >= firmware.T64:
        raise ValueError("Policy scratch overlaps signing scratch")
    resources = {
        "policyId": POLICY_ID,
        "baselineRomSha256": BASE_ROM_SHA256,
        "romSha256": hashlib.sha256(image).hexdigest(),
        "policySourceSha256": hashlib.sha256(policy.encode()).hexdigest(),
        "romBytes": len(image),
        "parserBytes": symbols["dts_policy_end"] - symbols["dts_policy_start"],
        "parserStart": symbols["dts_policy_start"],
        "parserEndExclusive": symbols["dts_policy_end"],
        "bytesBeforeVectors": 0xFFFA - symbols["dts_policy_after_test"],
        "scratchStart": symbols["DTS_PTR"],
        "scratchEndInclusive": symbols["DTS_KIND"],
        "scratchBytes": symbols["DTS_KIND"] - symbols["DTS_PTR"] + 1,
        "parserInternalStackBytes": 0,
        "parserCallStackBytes": 2,
        "profile": 0,
        "trustedReviewImplemented": False,
        "resetRecoveryImplemented": False,
        "hardwareMeasured": False,
    }
    return image, symbols, source, resources
