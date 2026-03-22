# Simd Rust demonstration

Comparison between using simd instruction and normal instruction

```
cargo run --profile release-unoptimized
```

But if we go with release, compiler will optimized for SIMD automatically

```
cargo run --release
```
