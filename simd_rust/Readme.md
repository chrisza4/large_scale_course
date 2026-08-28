# Simd Rust demonstration

Comparison between using simd instruction and normal instruction

```bash
make run
```

But if we go with release, compiler will optimized for SIMD automatically

```bash
make run-compiler-optimized
```

## Running scalar_add only

Run without compiler SIMD optimization:

```bash
make run-scalar-unoptimized
```

Run with release optimizations:

```bash
make run-scalar
```
