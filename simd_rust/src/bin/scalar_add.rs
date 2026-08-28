use rand::Rng;
use std::time::Instant;

const N: usize = 1024 * 1024 * 4; // 4M elements
const ITERATIONS: usize = 10;

// Task: 2 big array, a and b
// a[i] + b[i]

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
    scalar_add(&a, &b, &mut result);

    let data_size = (N * ITERATIONS * std::mem::size_of::<f32>()) as f64 / 1e9;
    println!("Data={data_size}gb, iterations={ITERATIONS}\n");

    bench("scalar_add:", || scalar_add(&a, &b, &mut result));
}
