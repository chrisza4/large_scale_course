.PHONY: run run-unoptimized run-compiler-optimized run-scalar run-scalar-unoptimized

run-compiler-optimized:
	cargo run --release

run:
	cargo run --profile release-unoptimized

run-scalar:
	cargo run --bin scalar_add --release

run-scalar-unoptimized:
	cargo run --bin scalar_add --profile release-unoptimized
