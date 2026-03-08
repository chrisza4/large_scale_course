use std::arch::asm;
use std::sync::Arc;
use std::time::Instant;

const N: usize = 1024 * 1024; // 1M elements (must be multiple of 4)
const ITERATIONS: usize = 100;
const NUM_TASKS: usize = 8;

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

async fn async_parallel_add(a: Arc<Vec<f32>>, b: Arc<Vec<f32>>, result: Arc<tokio::sync::Mutex<Vec<f32>>>) {
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
    let throughput = (N * ITERATIONS * std::mem::size_of::<f32>()) as f64 / elapsed.as_secs_f64() / 1e9;
    println!("{label:<12} {:.3}s  throughput: {throughput:.2} GB/s", elapsed.as_secs_f64());
}

#[tokio::main]
async fn main() {
    let a: Vec<f32> = (0..N).map(|i| i as f32).collect();
    let b: Vec<f32> = (0..N).map(|i| (i * 2) as f32).collect();
    let mut result = vec![0.0f32; N];

    // Warmup
    unsafe { simd_add(&a, &b, &mut result) };
    scalar_add(&a, &b, &mut result);

    let a_arc = Arc::new(a.clone());
    let b_arc = Arc::new(b.clone());
    let result_arc = Arc::new(tokio::sync::Mutex::new(vec![0.0f32; N]));
    async_parallel_add(Arc::clone(&a_arc), Arc::clone(&b_arc), Arc::clone(&result_arc)).await;

    println!("N={N}, iterations={ITERATIONS}, tasks={NUM_TASKS}");

    bench("simd_add:", || unsafe { simd_add(&a, &b, &mut result) });
    bench("scalar_add:", || scalar_add(&a, &b, &mut result));

    // Benchmark async parallel (timed outside tokio overhead)
    let start = Instant::now();
    for _ in 0..ITERATIONS {
        async_parallel_add(Arc::clone(&a_arc), Arc::clone(&b_arc), Arc::clone(&result_arc)).await;
    }
    let elapsed = start.elapsed();
    let throughput = (N * ITERATIONS * std::mem::size_of::<f32>()) as f64 / elapsed.as_secs_f64() / 1e9;
    println!("{:<12} {:.3}s  throughput: {throughput:.2} GB/s", "async_par:", elapsed.as_secs_f64());
}
