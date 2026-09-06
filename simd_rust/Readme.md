# Simd Rust demonstration

Comparison between using simd instruction and normal instruction

## How SIMD works

SIMD = **Single Instruction, Multiple Data**. One CPU instruction operates on a
whole vector of values at once, instead of one value per instruction.

### Scalar (normal) — one add per instruction

```
   a: [ 1 ][ 2 ][ 3 ][ 4 ]
   b: [ 5 ][ 6 ][ 7 ][ 8 ]

   step 1:  1 + 5  = 6      ADD
   step 2:  2 + 6  = 8      ADD
   step 3:  3 + 7  = 10     ADD
   step 4:  4 + 8  = 12     ADD

   ---> 4 instructions, 4 cycles
```

### SIMD — one add for the whole lane

```
        lane0 lane1 lane2 lane3
        +----+----+----+----+
   a =  |  1 |  2 |  3 |  4 |
        +----+----+----+----+
           |    |    |    |
           v    v    v    v        <-- single ADD.PS instruction
        +----+----+----+----+
   b =  |  5 |  6 |  7 |  8 |
        +----+----+----+----+
           |    |    |    |
           v    v    v    v
        +----+----+----+----+
  out = |  6 |  8 | 10 | 12 |
        +----+----+----+----+

   ---> 1 instruction, ~1 cycle
```

```bash
make run
```

But if we go with release, compiler will optimized for SIMD automatically

```bash
make run-compiler-optimized
```

## Running simple_concurrent

```bash
make run-simple-concurrent
```
