var idempotencyStore = new IdempotencyStore();
var counter = 0;
var counterLock = new object();

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapPost("/increment", async (HttpContext ctx) =>
{
    var key = ctx.Request.Headers["Idempotency-Key"].FirstOrDefault();
    if (string.IsNullOrEmpty(key))
        return Results.BadRequest("Missing Idempotency-Key header");

    var thisRand = Random.Shared.NextDouble();

    // 10% timeout
    if (thisRand < 0.1)
    {
        // Half of it, just simply slow response
        if (thisRand < 0.05)
        {
            await Task.Delay(1000);
        }
        // Another half, not processed
        else
        {
            await Task.Delay(1000, ctx.RequestAborted).ConfigureAwait(false);
            return Results.StatusCode(504);
        }
    }

    using (var reservation = idempotencyStore.GetOrReserve(key))
    {
        if (!reservation.IsNew)
        {
            try
            {
                return Results.Ok(new { value = await reservation.Task, @cached = true });
            }
            catch (OperationCanceledException)
            {
                // Original request failed; tell the client to retry
                return Results.StatusCode(503);
            }
        }

        int result;
        lock (counterLock)
        {
            counter++;
            result = counter;
        }

        reservation.Complete(result);
        return Results.Ok(new { value = result, @cached = false });
    }
});

app.Run();

app.MapPost("/reset", () =>
{
    lock (counterLock)
    {
        counter = 0;
    }
    idempotencyStore.Clear();
    return Results.Ok(new { message = "Reset" });
});
class IdempotencyStore
{
    private readonly Dictionary<string, TaskCompletionSource<int>> _store = [];
    private readonly Lock _lock = new();

    public Reservation GetOrReserve(string key)
    {
        // This is what prevent race condition, but it is not optimal (Excersise: Why and what could be better)
        lock (_lock)
        {
            if (_store.TryGetValue(key, out var existing))
                return new Reservation(this, key, existing.Task, isNew: false);
            var tcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
            _store[key] = tcs;
            return new Reservation(this, key, tcs.Task, isNew: true);
        }
    }

    internal void Complete(string key, int value)
    {
        lock (_lock)
            if (_store.TryGetValue(key, out var tcs))
                tcs.SetResult(value);
    }

    public void Clear()
    {
        lock (_lock)
        {
            foreach (var tcs in _store.Values)
                tcs.TrySetCanceled();
            _store.Clear();
        }
    }

    // Removes the reservation and unblocks any waiters with a cancellation so they can retry.
    internal void Cancel(string key)
    {
        lock (_lock)
            if (_store.Remove(key, out var tcs))
                tcs.TrySetCanceled();
    }
}

class Reservation(IdempotencyStore store, string key, Task<int> task, bool isNew) : IDisposable
{
    public bool IsNew { get; } = isNew;
    public Task<int> Task { get; } = task;
    private bool _completed;

    public void Complete(int value)
    {
        _completed = true;
        store.Complete(key, value);
    }

    // If the owner never called Complete (e.g. exception, early return), cancel the reservation
    // so waiting callers get a 503 and can retry rather than hanging forever.
    public void Dispose()
    {
        if (IsNew && !_completed)
            store.Cancel(key);
    }
}
