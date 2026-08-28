import json
import math
import os
import subprocess
import sys


def run_worker():
    worker_idx = sys.argv.index("--worker")
    chunk_index = sys.argv[worker_idx + 1]
    numbers = json.loads(sys.argv[worker_idx + 2])

    chunk_sum = sum(numbers)
    squares_sum = sum(n * n for n in numbers)

    print(
        json.dumps(
            {
                "chunkIndex": chunk_index,
                "count": len(numbers),
                "sum": chunk_sum,
                "squaresSum": squares_sum,
            }
        )
    )
    sys.exit(0)


def main():
    print(f"[Parent PID: {os.getpid()}] Starting Fork-Join execution...\n")

    data = list(range(1, 41))  # [1, 2, ..., 40]
    num_workers = 4
    chunk_size = math.ceil(len(data) / num_workers)

    print(f"Total items to process: {len(data)}")
    print(f"Splitting work across {num_workers} child processes...\n")

    print("--- [FORK PHASE] Spawning child processes ---")
    workers = []

    for i in range(num_workers):
        chunk = data[i * chunk_size : (i + 1) * chunk_size]

        # Spawn child process running this script with --worker
        # Equivalent to running: python index.py --worker <workerId> '<chunkJson>'
        proc = subprocess.Popen(
            [
                sys.executable,
                os.path.abspath(__file__),
                "--worker",
                str(i + 1),
                json.dumps(chunk),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        print(
            f"[Forked] Worker #{i + 1} (PID: {proc.pid}) processing {len(chunk)} items"
        )
        workers.append(proc)

    # 3. JOIN: Wait for all child processes to complete
    print("\n--- [JOIN PHASE] Waiting for all workers to finish ---")
    results = []
    for proc in workers:
        stdout, stderr = proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"Worker failed: {stderr}")
        results.append(json.loads(stdout.strip()))

    # 4. Aggregate results
    print("\n--- [AGGREGATION] ---")
    total_sum = 0
    total_squares_sum = 0

    for res in results:
        print(
            f"Worker #{res['chunkIndex']} returned -> sum: {res['sum']}, squaresSum: {res['squaresSum']}"
        )
        total_sum += res["sum"]
        total_squares_sum += res["squaresSum"]

    print("\n================ Final Result ================")
    print(f"Total Sum: {total_sum}")
    print(f"Total Squares Sum: {total_squares_sum}")
    print("==============================================")


if __name__ == "__main__":
    if "--worker" in sys.argv:
        run_worker()
    else:
        main()
