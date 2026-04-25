#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <pthread.h>

static bool compare_and_swap(int64_t *ptr, int64_t expected, int64_t desired) {
    int64_t old = expected;
    // casal: compare-and-swap acquire-release (ARMv8.1+)
    __asm__ volatile (
        "casal %[old], %[desired], [%[ptr]]"
        : [old]     "+r" (old)
        : [desired] "r"  (desired),
          [ptr]     "r"  (ptr)
        : "memory"
    );
    return old == expected;
}

// ---------------------------------------------------------------------------
// Mutex built on CAS
// ---------------------------------------------------------------------------

static void cas_mutex_lock(int64_t *m) {
    while (!compare_and_swap(m, 0, 1))
        ;
}

static void cas_mutex_unlock(int64_t *m) {
    *m = 0;
}

// ---------------------------------------------------------------------------
// Demo: two threads racing to increment a shared counter
// ---------------------------------------------------------------------------

#define ITERATIONS 100000

static volatile int64_t g_mutex   = 0;
static volatile int64_t g_counter = 0;

static void *worker(void *arg) {
    int use_mutex = (int)(intptr_t)arg;
    for (int i = 0; i < ITERATIONS; i++) {
        if (use_mutex) cas_mutex_lock(&g_mutex);
        g_counter++;
        if (use_mutex) cas_mutex_unlock(&g_mutex);
    }
    return NULL;
}

static void demo_cas(void) {
    printf("=== CAS Demo ===\n");
    int64_t value = 42;
    bool ok = compare_and_swap(&value, 42, 100);
    printf("CAS(42 → 100): %s | value = %lld\n",
           ok ? "✓ swapped" : "✗ failed", (long long)value);

    ok = compare_and_swap(&value, 42, 999);
    printf("CAS(42 → 999): %s | value = %lld\n",
           ok ? "✓ swapped" : "✗ failed", (long long)value);
}

static void run_threads(int use_mutex) {
    g_counter = 0;
    g_mutex   = 0;
    pthread_t t1, t2;
    pthread_create(&t1, NULL, worker, (void *)(intptr_t)use_mutex);
    pthread_create(&t2, NULL, worker, (void *)(intptr_t)use_mutex);
    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
}

static void demo_mutex(void) {
    printf("=== Mutex Demo ===\n");
    printf("Two threads × %d increments each\n\n", ITERATIONS);

    run_threads(0);
    printf("Without mutex — Expected: %d | Got: %lld | %s\n",
           2 * ITERATIONS, (long long)g_counter,
           g_counter == 2 * ITERATIONS ? "✓ correct" : "✗ race detected");

    run_threads(1);
    printf("With mutex    — Expected: %d | Got: %lld | %s\n",
           2 * ITERATIONS, (long long)g_counter,
           g_counter == 2 * ITERATIONS ? "✓ correct" : "✗ race detected");
}

int main(void) {
    printf("Select demo:\n");
    printf("  1) CAS demo\n");
    printf("  2) Mutex demo\n");
    printf("  3) Both\n");
    printf("Choice: ");

    int choice = 0;
    scanf("%d", &choice);
    printf("\n");

    switch (choice) {
        case 1: demo_cas();   break;
        case 2: demo_mutex(); break;
        case 3: demo_cas(); printf("\n"); demo_mutex(); break;
        default: printf("Invalid choice.\n"); return 1;
    }

    return 0;
}
