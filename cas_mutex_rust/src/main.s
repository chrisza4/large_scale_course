// ARM64 assembly (macOS/AArch64) equivalent of src/main.rs
// Syscall convention: x16=number, x0-x5=args, svc #0x80
// write(fd, buf, len): x16=4, x0=1(stdout), x1=ptr, x2=len

.section __TEXT,__text
.globl _main
.align 2

// compare_and_swap(ptr: x0, expected: x1, desired: x2) -> bool (x0)
// casal: compare-and-swap acquire-release (ARMv8.1+)
// if *ptr == expected, writes desired; returns 1 if swapped, 0 otherwise
_compare_and_swap:
    mov     x3, x1              // old = expected
    casal   x3, x2, [x0]       // if *ptr==x3: *ptr=x2; x3=actual old value
    cmp     x3, x1              // old == expected?
    cset    x0, eq              // x0 = 1 if equal, 0 otherwise
    ret

_main:
    stp     x29, x30, [sp, #-16]!
    mov     x29, sp

    // i64 value = 42 on the stack at [sp, #-8]
    sub     sp, sp, #16
    mov     x0, #42
    str     x0, [sp]            // value = 42

    // --- CAS(42 → 100) ---
    mov     x0, sp              // ptr = &value
    mov     x1, #42             // expected
    mov     x2, #100            // desired
    bl      _compare_and_swap   // x0 = result (1=swapped)

    ldr     x1, [sp]            // load current value
    mov     x2, x0              // save CAS result
    adrp    x0, msg_cas1_ok@PAGE
    add     x0, x0, msg_cas1_ok@PAGEOFF
    cmp     x2, #1
    b.eq    1f
    adrp    x0, msg_cas1_fail@PAGE
    add     x0, x0, msg_cas1_fail@PAGEOFF
1:
    // print the message string
    bl      _print_cas_line     // x0=msg ptr, x1=current value

    // --- CAS(42 → 999) ---
    mov     x0, sp              // ptr = &value
    mov     x1, #42             // expected (will fail; value is now 100)
    mov     x2, #999            // desired
    bl      _compare_and_swap

    ldr     x1, [sp]
    mov     x2, x0
    adrp    x0, msg_cas2_ok@PAGE
    add     x0, x0, msg_cas2_ok@PAGEOFF
    cmp     x2, #1
    b.eq    2f
    adrp    x0, msg_cas2_fail@PAGE
    add     x0, x0, msg_cas2_fail@PAGEOFF
2:
    bl      _print_cas_line

    // exit(0)
    mov     x0, #0
    mov     x16, #1
    svc     #0x80

// _print_cas_line(msg: x0, value: x1)
// Prints: "<msg> | value = <value>\n"
_print_cas_line:
    stp     x29, x30, [sp, #-48]!
    mov     x29, sp
    str     x0, [sp, #16]       // save msg ptr
    str     x1, [sp, #24]       // save value

    // write(1, msg, msg_len) — find length first
    mov     x19, x0
    bl      _strlen
    mov     x2, x0              // len
    mov     x1, x19             // buf
    mov     x0, #1              // fd=stdout
    mov     x16, #4
    svc     #0x80

    // write " | value = "
    adrp    x19, str_sep@PAGE
    add     x19, x19, str_sep@PAGEOFF
    mov     x0, x19
    bl      _strlen
    mov     x2, x0
    mov     x1, x19
    mov     x0, #1
    mov     x16, #4
    svc     #0x80

    // convert value (x1 saved) to decimal string and print
    ldr     x0, [sp, #24]
    bl      _print_i64

    // write newline
    adrp    x1, str_nl@PAGE
    add     x1, x1, str_nl@PAGEOFF
    mov     x0, #1
    mov     x2, #1
    mov     x16, #4
    svc     #0x80

    ldp     x29, x30, [sp], #48
    ret

// _strlen(s: x0) -> len in x0
_strlen:
    mov     x1, x0
0:  ldrb    w2, [x1], #1
    cbnz    w2, 0b
    sub     x0, x1, x0
    sub     x0, x0, #1
    ret

// _print_i64(val: x0) — prints decimal representation of signed 64-bit int
_print_i64:
    stp     x29, x30, [sp, #-64]!
    mov     x29, sp

    // buffer of 22 bytes on stack, fill from end
    add     x8, sp, #40         // end of digit buffer
    mov     x9, x8
    mov     x10, x0             // value
    mov     x11, #0             // negative flag

    cmp     x10, #0
    b.ge    3f
    neg     x10, x10
    mov     x11, #1
3:
    mov     x12, #10
4:  udiv    x13, x10, x12
    msub    x14, x13, x12, x10  // remainder
    add     x14, x14, #48       // '0' + digit
    sub     x9, x9, #1
    strb    w14, [x9]
    mov     x10, x13
    cbnz    x10, 4b

    cbz     x11, 5f
    sub     x9, x9, #1
    mov     w14, #45            // '-'
    strb    w14, [x9]
5:
    sub     x2, x8, x9          // length
    mov     x1, x9
    mov     x0, #1
    mov     x16, #4
    svc     #0x80

    ldp     x29, x30, [sp], #64
    ret

.section __TEXT,__cstring
msg_cas1_ok:    .asciz "CAS(42 \xe2\x86\x92 100): \xe2\x9c\x93 swapped"
msg_cas1_fail:  .asciz "CAS(42 \xe2\x86\x92 100): \xe2\x9c\x97 failed"
msg_cas2_ok:    .asciz "CAS(42 \xe2\x86\x92 999): \xe2\x9c\x93 swapped"
msg_cas2_fail:  .asciz "CAS(42 \xe2\x86\x92 999): \xe2\x9c\x97 failed"
str_sep:        .asciz " | value = "
str_nl:         .byte 0x0a
