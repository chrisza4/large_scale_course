fn compare_and_swap(ptr: *mut i64, expected: i64, desired: i64) -> bool {
    // casal: compare-and-swap acquire-release (ARMv8.1+)
    // loads old value into `old` register; if old == expected, stores desired.
    // on return, `old` holds the actual previous memory value.
    let mut old = expected;
    unsafe {
        std::arch::asm!(
            "casal {old}, {desired}, [{ptr}]",
            ptr     = in(reg)      ptr,
            desired = in(reg)      desired,
            old     = inout(reg)   old,
        );
    }
    old == expected
}

fn main() {
    let mut value: i64 = 42;
    let ptr = &mut value as *mut i64;

    let ok = compare_and_swap(ptr, 42, 100);
    println!(
        "CAS(42 → 100): {} | value = {}",
        if ok { "✓ swapped" } else { "✗ failed" },
        value
    );

    let ok = compare_and_swap(ptr, 42, 999);
    println!(
        "CAS(42 → 999): {} | value = {}",
        if ok { "✓ swapped" } else { "✗ failed" },
        value
    );
}
