; Experimental DTS Console public-fixture policy, not a live-key profile.
; Input: frozen message at $4000; length, profile and expected key at $5000.
; Requires MESSAGE_LOCK=1, RESULT_LOCK=0, FAULT=0. Other latch states enter
; a ROM-only hold without touching SRAM. The caller must initialize the stack.
; Success: A=0, C=0. Failure: A=$E1..$E6, C=1; no review output is valid.
; Clobbers A/X/Y, flags, $61-$6B. No subroutine calls or pushes here.
; On success KIND=1/2, RECIP and AMOUNT are byte offsets into frozen $4000.
; This routine does not display fields, obtain approval or authorize a live key.

DTS_PTR = $61
DTS_END = $63
DTS_LEFT = $64
DTS_RIGHT = $65
DTS_COUNT = $66
DTS_TAIL = $67
DTS_TAIL_LEN = $68
DTS_AMOUNT = $69
DTS_RECIP = $6A
DTS_KIND = $6B

dts_policy_start:
dts_policy_check:
    LDA $7F01
    AND #$E0
    CMP #$20
    BEQ dts_policy_latches_ok
    JMP dts_policy_hold
dts_policy_latches_ok:
    CLD
    STZ DTS_KIND
    STZ DTS_RECIP
    STZ DTS_AMOUNT
    LDA $5002
    BEQ dts_policy_profile_ok
    LDA #$E1
    SEC
    RTS
dts_policy_profile_ok:
    LDA $5001
    BEQ dts_policy_length_low
dts_policy_bad_length:
    LDA #$E2
    SEC
    RTS
dts_policy_length_low:
    LDA $5000
    CMP #150
    BEQ dts_policy_legacy
    CMP #224
    BNE dts_policy_bad_length
    LDA #<dts_policy_nonce_header
    STA DTS_PTR
    LDA #>dts_policy_nonce_header
    STA DTS_PTR+1
    LDA #164
    STA DTS_END
    LDA #196
    STA DTS_TAIL
    LDA #20
    STA DTS_TAIL_LEN
    BRA dts_policy_header
dts_policy_legacy:
    LDA #<dts_policy_legacy_header
    STA DTS_PTR
    LDA #>dts_policy_legacy_header
    STA DTS_PTR+1
    LDA #100
    STA DTS_END
    LDA #132
    STA DTS_TAIL
    LDA #10
    STA DTS_TAIL_LEN
dts_policy_header:
    LDY #3
dts_policy_header_loop:
    LDA $4000,Y
    CMP (DTS_PTR),Y
    BNE dts_policy_bad_layout
    DEY
    BPL dts_policy_header_loop
    LDX #31
dts_policy_key_loop:
    LDA dts_policy_public_key,X
    CMP $4004,X
    BNE dts_policy_bad_key
    CMP $5003,X
    BNE dts_policy_bad_key
    DEX
    BPL dts_policy_key_loop
    ; The last account is the all-zero System Program ID.
    LDY DTS_END
    LDX #32
    LDA #0
dts_policy_system_loop:
    DEY
    ORA $4000,Y
    DEX
    BNE dts_policy_system_loop
    CMP #0
    BNE dts_policy_bad_layout
    LDA DTS_END
    CMP #100
    BEQ dts_policy_tail_legacy
    LDX #31
dts_policy_sysvar_loop:
    LDA $4064,X
    CMP dts_policy_recent_blockhashes,X
    BNE dts_policy_bad_layout
    DEX
    BPL dts_policy_sysvar_loop
    LDA #<dts_policy_nonce_tail
    STA DTS_PTR
    LDA #>dts_policy_nonce_tail
    STA DTS_PTR+1
    BRA dts_policy_tail
dts_policy_bad_key:
    LDA #$E3
    SEC
    RTS
dts_policy_bad_layout:
    LDA #$E4
    SEC
    RTS
dts_policy_tail_legacy:
    LDA #<dts_policy_legacy_tail
    STA DTS_PTR
    LDA #>dts_policy_legacy_tail
    STA DTS_PTR+1
dts_policy_tail:
    LDY #0
    LDX DTS_TAIL
dts_policy_tail_loop:
    LDA $4000,X
    CMP (DTS_PTR),Y
    BNE dts_policy_bad_layout
    INX
    INY
    CPY DTS_TAIL_LEN
    BNE dts_policy_tail_loop
    ; X now points at the little-endian u64 amount. Every nonzero u64 fits.
    LDY #8
    LDA #0
dts_policy_amount_loop:
    ORA $4000,X
    INX
    DEY
    BNE dts_policy_amount_loop
    CMP #0
    BNE dts_policy_unique
    LDA #$E5
    SEC
    RTS
dts_policy_unique:
    ; Compare every pair of accounts, including the System Program and sysvar.
    LDA #4
    STA DTS_LEFT
dts_policy_pair_outer:
    LDA DTS_LEFT
    CLC
    ADC #32
    CMP DTS_END
    BCS dts_policy_ok
    STA DTS_RIGHT
dts_policy_pair_inner:
    LDX DTS_LEFT
    LDY DTS_RIGHT
    LDA #32
    STA DTS_COUNT
dts_policy_pair_bytes:
    LDA $4000,X
    CMP $4000,Y
    BNE dts_policy_pair_different
    INX
    INY
    DEC DTS_COUNT
    BNE dts_policy_pair_bytes
    LDA #$E6
    SEC
    RTS
dts_policy_pair_different:
    LDA DTS_RIGHT
    CLC
    ADC #32
    STA DTS_RIGHT
    CMP DTS_END
    BCC dts_policy_pair_inner
    LDA DTS_LEFT
    CLC
    ADC #32
    STA DTS_LEFT
    BRA dts_policy_pair_outer
dts_policy_ok:
    ; Publish offsets only after every check. These point into locked memory.
    LDA $5000
    SEC
    SBC #8
    STA DTS_AMOUNT
    LDA #36
    LDX #1
    LDY DTS_END
    CPY #100
    BEQ dts_policy_review_offsets
    LDA #68
    INX
dts_policy_review_offsets:
    STA DTS_RECIP
    STX DTS_KIND
    LDA #0
    CLC
    RTS

dts_policy_hold:
    ; Read-only fault/invalid-state hold. No stack, SRAM read/write or return.
    LDA #0
    STA $7F02
dts_policy_hold_loop:
    JMP dts_policy_hold_loop

dts_policy_legacy_header:
    .byte 1, 0, 1, 3
dts_policy_nonce_header:
    .byte 1, 0, 2, 5
dts_policy_legacy_tail:
    .byte 1, 2, 2, 0, 1, 12, 2, 0, 0, 0
dts_policy_nonce_tail:
    .byte 2, 4, 3, 1, 3, 0, 4, 4, 0, 0, 0, 4, 2, 0, 2, 12, 2, 0, 0, 0
dts_policy_public_key:
    .byte $D7, $5A, $98, $01, $82, $B1, $0A, $B7, $D5, $4B, $FE, $D3, $C9, $64, $07, $3A
    .byte $0E, $E1, $72, $F3, $DA, $A6, $23, $25, $AF, $02, $1A, $68, $F7, $07, $51, $1A
dts_policy_recent_blockhashes:
    .byte $06, $A7, $D5, $17, $19, $2C, $56, $8E, $E0, $8A, $84, $5F, $73, $D2, $97, $88
    .byte $CF, $03, $5C, $31, $45, $B2, $1A, $B3, $44, $D8, $06, $2E, $A9, $40, $00, $00
dts_policy_end:
