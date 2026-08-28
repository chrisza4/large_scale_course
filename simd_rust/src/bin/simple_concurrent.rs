use rand::Rng;
use std::arch::asm;
use std::time::Instant;

const N: usize = 1024 * 1024 * 4; // 4M elements (must be multiple of 4)
const ITERATIONS: usize = 10;

// Task: 2 big array, a and b
// a[i] + b[i]

fn scalar_add(a: &[f32], b: &[f32], result: &mut [f32]) {
    for i in 0..a.len() {
        result[i] = a[i] + b[i];
    }
}

unsafe fn simd_add_chunk(a: &[f32], b: &[f32], result: &mut [f32]) {
    let len = a.len();
    let chunks16 = len / 16;
    for i in 0..chunks16 {
        let offset = i * 16;
        unsafe {
            asm!(
                // Prefetch 512 bytes ahead to hide memory latency
                "prfm pldl1keep, [{pa}, #512]",
                "prfm pldl1keep, [{pb}, #512]",
                // Load 16 floats from a and b (4 registers × 4 floats = 64 bytes each)
                "ld1.4s {{v0, v1, v2, v3}}, [{pa}]",
                "ld1.4s {{v4, v5, v6, v7}}, [{pb}]",
                // 4 independent adds — CPU can pipeline these
                "fadd.4s v0, v0, v4",
                "fadd.4s v1, v1, v5",
                "fadd.4s v2, v2, v6",
                "fadd.4s v3, v3, v7",
                // Store 16 results
                "st1.4s {{v0, v1, v2, v3}}, [{pr}]",
                pa = in(reg) a.as_ptr().add(offset),
                pb = in(reg) b.as_ptr().add(offset),
                pr = in(reg) result.as_mut_ptr().add(offset),
                out("v0") _, out("v1") _, out("v2") _, out("v3") _,
                out("v4") _, out("v5") _, out("v6") _, out("v7") _,
            );
        }
    }
    // Handle remaining floats (in multiples of 4, since N is a multiple of 4)
    let rem_start = chunks16 * 16;
    let rem_chunks = (len - rem_start) / 4;
    for i in 0..rem_chunks {
        let offset = rem_start + i * 4;
        unsafe {
            asm!(
                "ld1.4s {{v0}}, [{pa}]",
                "ld1.4s {{v1}}, [{pb}]",
                "fadd.4s v0, v0, v1",
                "st1.4s {{v0}}, [{pr}]",
                pa = in(reg) a.as_ptr().add(offset),
                pb = in(reg) b.as_ptr().add(offset),
                pr = in(reg) result.as_mut_ptr().add(offset),
                out("v0") _,
                out("v1") _,
            );
        }
    }
}

fn bench<F: FnMut()>(label: &str, mut f: F) {
    let start = Instant::now();
    for _ in 0..ITERATIONS {
        f();
    }
    let elapsed = start.elapsed();
    let throughput =
        (N * ITERATIONS * std::mem::size_of::<f32>()) as f64 / elapsed.as_secs_f64() / 1e9;
    println!(
        "{label:<35} {:.3}s  throughput: {throughput:.2} GB/s",
        elapsed.as_secs_f64()
    );
}

fn main() {
    let mut rng = rand::thread_rng();
    let a: Vec<f32> = (0..N).map(|_| rng.r#gen::<f32>()).collect();
    let b: Vec<f32> = (0..N).map(|_| rng.r#gen::<f32>()).collect();
    let mut result = vec![0.0f32; N];

    // Warmup
    unsafe { simd_add_chunk(&a, &b, &mut result) };
    scalar_add(&a, &b, &mut result);

    let data_size = (N * ITERATIONS * std::mem::size_of::<f32>()) as f64 / 1e9;
    println!("Data={data_size}gb, iterations={ITERATIONS}\n");

    bench("scalar_add:", || scalar_add(&a, &b, &mut result));
    bench("simd_add_chunk:", || unsafe {
        simd_add_chunk(&a, &b, &mut result)
    });
}
