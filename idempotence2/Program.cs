var idempotencyStore = new IdempotencyStore();
var counter = 0;
var counterLock = new object();

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapPost("/reset", () =>
{
    lock (counterLock)
    {
        counter = 0;
    }
    idempotencyStore.Clear();
    return Results.Ok(new { message = "Reset" });
});

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

    var (isNew, task) = idempotencyStore.GetOrReserve(key);
    if (!isNew)
    {
        try
        {
            return Results.Ok(new { value = await task, @cached = true });
        }
        catch (OperationCanceledException)
        {
            // Original request failed; tell the client to retry
            return Results.StatusCode(503);
        }
    }

    try
    {
        int result;
        lock (counterLock)
        {
            counter++;
            result = counter;
        }

        idempotencyStore.Complete(key, result);
        return Results.Ok(new { value = result, @cached = false });
    }
    catch
    {
        idempotencyStore.Cancel(key);
        throw;
    }
});

app.Run();

class IdempotencyStore
{
    private readonly Dictionary<string, TaskCompletionSource<int>> _store = [];
    private readonly Lock _lock = new();

    // Atomically reserves the key. Returns isNew=true if this caller owns the work;
    // isNew=false means another request is already in flight — await the task for its result.
    public (bool isNew, Task<int> task) GetOrReserve(string key)
    {
        lock (_lock)
        {
            if (_store.TryGetValue(key, out var existing))
                return (false, existing.Task);
            var tcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
            _store[key] = tcs;
            return (true, tcs.Task);
        }
    }

    public void Complete(string key, int value)
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
    public void Cancel(string key)
    {
        lock (_lock)
            if (_store.Remove(key, out var tcs))
                tcs.TrySetCanceled();
    }
}
