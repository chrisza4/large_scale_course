use std::arch::asm;
use std::time::Instant;

const N: usize = 1024 * 1024; // 1M elements (must be multiple of 4)
const ITERATIONS: usize = 100;

unsafe fn simd_add(a: &[f32], b: &[f32], result: &mut [f32]) {
    let chunks = a.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;
        unsafe {
            asm!(
                "ld1.4s {{v0}}, [{input1}]",
                "ld1.4s {{v1}}, [{input2}]",
                "fadd.4s v0, v0, v1",
                "st1.4s {{v0}}, [{output_reg}]",
                input1 = in(reg) a.as_ptr().add(offset),
                input2 = in(reg) b.as_ptr().add(offset),
                output_reg = in(reg) result.as_mut_ptr().add(offset),
                out("v0") _,
                out("v1") _,
            );
        }
    }
}

fn scalar_add(a: &[f32], b: &[f32], result: &mut [f32]) {
    for i in 0..a.len() {
        result[i] = a[i] + b[i];
    }
}

fn bench<F: FnMut()>(label: &str, mut f: F) {
    let start = Instant::now();
    for _ in 0..ITERATIONS {
        f();
    }
    let elapsed = start.elapsed();
    let throughput = (N * ITERATIONS * std::mem::size_of::<f32>()) as f64 / elapsed.as_secs_f64() / 1e9;
    println!("{label:<12} {:.3}s  throughput: {throughput:.2} GB/s", elapsed.as_secs_f64());
}

fn main() {
    let a: Vec<f32> = (0..N).map(|i| i as f32).collect();
    let b: Vec<f32> = (0..N).map(|i| (i * 2) as f32).collect();
    let mut result = vec![0.0f32; N];

    // Warmup
    unsafe { simd_add(&a, &b, &mut result) };
    scalar_add(&a, &b, &mut result);

    println!("N={N}, iterations={ITERATIONS}");

    bench("simd_add:", || unsafe { simd_add(&a, &b, &mut result) });
    bench("scalar_add:", || scalar_add(&a, &b, &mut result));
}
