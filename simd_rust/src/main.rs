use std::arch::asm;
use std::sync::Arc;
use std::thread;
use std::time::Instant;

const N: usize = 1024 * 1024; // 1M elements (must be multiple of 4)
const ITERATIONS: usize = 100;
const NUM_TASKS: usize = 8;

unsafe fn simd_add_chunk(a: &[f32], b: &[f32], result: &mut [f32]) {
    let len = a.len();
    // Unrolled: process 4 SIMD vectors (16 floats) per iteration
    let unrolled_chunks = len / 16;
    for i in 0..unrolled_chunks {
        let offset = i * 16;
        unsafe {
            asm!(
                "ld1.4s {{v0}}, [{p1}]",
                "ld1.4s {{v1}}, [{p2}]",
                "ld1.4s {{v2}}, [{p3}]",
                "ld1.4s {{v3}}, [{p4}]",
                "ld1.4s {{v4}}, [{q1}]",
                "ld1.4s {{v5}}, [{q2}]",
                "ld1.4s {{v6}}, [{q3}]",
                "ld1.4s {{v7}}, [{q4}]",
                "fadd.4s v0, v0, v4",
                "fadd.4s v1, v1, v5",
                "fadd.4s v2, v2, v6",
                "fadd.4s v3, v3, v7",
                "st1.4s {{v0}}, [{r1}]",
                "st1.4s {{v1}}, [{r2}]",
                "st1.4s {{v2}}, [{r3}]",
                "st1.4s {{v3}}, [{r4}]",
                p1 = in(reg) a.as_ptr().add(offset),
                p2 = in(reg) a.as_ptr().add(offset + 4),
                p3 = in(reg) a.as_ptr().add(offset + 8),
                p4 = in(reg) a.as_ptr().add(offset + 12),
                q1 = in(reg) b.as_ptr().add(offset),
                q2 = in(reg) b.as_ptr().add(offset + 4),
                q3 = in(reg) b.as_ptr().add(offset + 8),
                q4 = in(reg) b.as_ptr().add(offset + 12),
                r1 = in(reg) result.as_mut_ptr().add(offset),
                r2 = in(reg) result.as_mut_ptr().add(offset + 4),
                r3 = in(reg) result.as_mut_ptr().add(offset + 8),
                r4 = in(reg) result.as_mut_ptr().add(offset + 12),
                out("v0") _, out("v1") _, out("v2") _, out("v3") _,
                out("v4") _, out("v5") _, out("v6") _, out("v7") _,
            );
        }
    }
    // Handle remaining elements (in groups of 4)
    let remainder_start = unrolled_chunks * 16;
    let remaining_chunks = (len - remainder_start) / 4;
    for i in 0..remaining_chunks {
        let offset = remainder_start + i * 4;
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

fn simd_parallel_add(a: &[f32], b: &[f32], result: &mut [f32]) {
    let chunk_size = a.len() / NUM_TASKS;
    let a_ptr = a.as_ptr() as usize;
    let b_ptr = b.as_ptr() as usize;
    let r_ptr = result.as_mut_ptr() as usize;

    thread::scope(|s| {
        for t in 0..NUM_TASKS {
            let start = t * chunk_size;
            let end = start + chunk_size;
            s.spawn(move || unsafe {
                let a_chunk =
                    std::slice::from_raw_parts((a_ptr + start * 4) as *const f32, end - start);
                let b_chunk =
                    std::slice::from_raw_parts((b_ptr + start * 4) as *const f32, end - start);
                let r_chunk =
                    std::slice::from_raw_parts_mut((r_ptr + start * 4) as *mut f32, end - start);
                simd_add_chunk(a_chunk, b_chunk, r_chunk);
            });
        }
    });
}

fn scalar_add(a: &[f32], b: &[f32], result: &mut [f32]) {
    for i in 0..a.len() {
        result[i] = a[i] + b[i];
    }
}

async fn async_parallel_add(
    a: Arc<Vec<f32>>,
    b: Arc<Vec<f32>>,
    result: Arc<tokio::sync::Mutex<Vec<f32>>>,
) {
    let chunk_size = N / NUM_TASKS;
    let mut handles = Vec::with_capacity(NUM_TASKS);

    for t in 0..NUM_TASKS {
        let a = Arc::clone(&a);
        let b = Arc::clone(&b);
        let result = Arc::clone(&result);
        let start = t * chunk_size;
        let end = start + chunk_size;

        handles.push(tokio::spawn(async move {
            let partial: Vec<f32> = a[start..end]
                .iter()
                .zip(b[start..end].iter())
                .map(|(x, y)| x + y)
                .collect();
            let mut res = result.lock().await;
            res[start..end].copy_from_slice(&partial);
        }));
    }

    for h in handles {
        h.await.unwrap();
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
        "{label:<12} {:.3}s  throughput: {throughput:.2} GB/s",
        elapsed.as_secs_f64()
    );
}

#[tokio::main]
async fn main() {
    let a: Vec<f32> = (0..N).map(|i| i as f32).collect();
    let b: Vec<f32> = (0..N).map(|i| (i * 2) as f32).collect();
    let mut result = vec![0.0f32; N];

    // Warmup
    unsafe { simd_add_chunk(&a, &b, &mut result) };
    scalar_add(&a, &b, &mut result);

    println!("N={N}, iterations={ITERATIONS}, num_tasks={NUM_TASKS}");

    bench("simd_add_chunk:", || unsafe {
        simd_add_chunk(&a, &b, &mut result)
    });
    bench("simd_parallel_add:", || {
        simd_parallel_add(&a, &b, &mut result)
    });
    bench("scalar_add:", || scalar_add(&a, &b, &mut result));

    let a = Arc::new(a);
    let b = Arc::new(b);
    let async_result = Arc::new(tokio::sync::Mutex::new(vec![0.0f32; N]));
    let handle = tokio::runtime::Handle::current();

    bench("async_parallel_add:", || {
        tokio::task::block_in_place(|| {
            handle.block_on(async_parallel_add(
                Arc::clone(&a),
                Arc::clone(&b),
                Arc::clone(&async_result),
            ));
        });
    });
}
