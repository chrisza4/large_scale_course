use rand::Rng;
use std::arch::asm;
use std::sync::Arc;
use std::thread;
use std::time::Instant;

const N: usize = 1024 * 1024 * 4; // 4M elements (camust be multiple of 4)
const ITERATIONS: usize = 10;
const NUM_TASKS: usize = 8;

// Task: 2 big array, a and b
// a[i] + b[i]

fn scalar_add(a: &[f32], b: &[f32], result: &mut [f32]) {
    for i in 0..a.len() {
        result[i] = a[i] + b[i];
    }
}

async fn async_parallel_add(a: Arc<Vec<f32>>, b: Arc<Vec<f32>>, result: Arc<Vec<f32>>) {
    let chunk_size = a.len() / NUM_TASKS;
    let a_ptr = a.as_ptr() as usize;
    let b_ptr = b.as_ptr() as usize;
    let r_ptr = result.as_ptr() as usize;
    let mut handles = Vec::with_capacity(NUM_TASKS);

    for t in 0..NUM_TASKS {
        let start = t * chunk_size;
        let end = start + chunk_size;

        handles.push(tokio::spawn(async move {
            unsafe {
                let a_chunk =
                    std::slice::from_raw_parts((a_ptr + start * 4) as *const f32, end - start);
                let b_chunk =
                    std::slice::from_raw_parts((b_ptr + start * 4) as *const f32, end - start);
                let r_chunk =
                    std::slice::from_raw_parts_mut((r_ptr + start * 4) as *mut f32, end - start);
                for i in 0..r_chunk.len() {
                    r_chunk[i] = a_chunk[i] + b_chunk[i];
                }
            }
        }));
    }

    for h in handles {
        h.await.unwrap();
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

fn thread_parallel_add(a: &[f32], b: &[f32], result: &mut [f32]) {
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
                for i in 0..r_chunk.len() {
                    r_chunk[i] = a_chunk[i] + b_chunk[i];
                }
            });
        }
    });
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
#[tokio::main]
async fn main() {
    let mut rng = rand::thread_rng();
    let a: Vec<f32> = (0..N).map(|_| rng.r#gen::<f32>()).collect();
    let b: Vec<f32> = (0..N).map(|_| rng.r#gen::<f32>()).collect();
    let mut result = vec![0.0f32; N];

    // Warmup
    unsafe { simd_add_chunk(&a, &b, &mut result) };
    scalar_add(&a, &b, &mut result);

    let data_size = (N * ITERATIONS * std::mem::size_of::<f32>()) as f64 / 1e9;
    println!("Data={data_size}gb, iterations={ITERATIONS}, num_tasks={NUM_TASKS}\n");

    let a = Arc::new(a);
    let b = Arc::new(b);
    let async_result = Arc::new(vec![0.0f32; N]);
    let handle = tokio::runtime::Handle::current();

    bench("scalar_add:", || scalar_add(&a, &b, &mut result));
    bench("async_parallel_add:", || {
        tokio::task::block_in_place(|| {
            handle.block_on(async_parallel_add(
                Arc::clone(&a),
                Arc::clone(&b),
                Arc::clone(&async_result),
            ));
        });
    });
    bench("thread_parallel_add:", || {
        thread_parallel_add(&a, &b, &mut result)
    });
    bench("simd_add_chunk:", || unsafe {
        simd_add_chunk(&a, &b, &mut result)
    });
    bench("simd_parallel_add:", || {
        simd_parallel_add(&a, &b, &mut result)
    });
}
