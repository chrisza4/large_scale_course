use std::arch::asm;

fn main() {
    let a: [f32; 4] = [1.0, 2.0, 3.0, 1.0];
    let b: [f32; 4] = [5.0, 6.0, 7.0, 8.0];
    let mut result: [f32; 4] = [0.0; 4];

    unsafe {
        asm!(
            "ld1.4s {{v0}}, [{input1}]",
            "ld1.4s {{v1}}, [{input2}]",
            "fadd.4s v0, v0, v1",
            "st1.4s {{v0}}, [{output_reg}]",
            input1 = in(reg) a.as_ptr(),
            input2 = in(reg) b.as_ptr(),
            output_reg = in(reg) result.as_mut_ptr(),
            out("v0") _,
            out("v1") _,
        );
    }

    println!("{:?}", result);
}
