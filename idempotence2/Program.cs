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

    int? cached;
    try
    {
        cached = idempotencyStore.GetOrWait(key);
    }
    catch (OperationCanceledException)
    {
        // Original request failed; tell the client to retry
        return Results.StatusCode(503);
    }

    if (cached.HasValue)
        return Results.Ok(new { value = cached.Value, @cached = true });

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

app.MapPost("/reset", () =>
{
    lock (counterLock)
        counter = 0;
    idempotencyStore.Clear();
    return Results.Ok(new { message = "Reset" });
});

app.Run();

class IdempotencyStore
{
    enum State { Pending, Done, Cancelled }

    // There is more optimal way for this, using TaskCompletionSource. But this is too C# things
    record Entry(State State, int Result = 0);

    private readonly Dictionary<string, Entry> _store = new();

    private readonly object _mutex = new();

    // Returns null  → you are the owner; call Complete() or Cancel() when done.
    // Returns int   → cached result from a previous completed request.
    // Throws OperationCanceledException → previous request failed; caller should return 503.
    public int? GetOrWait(string key)
    {
        lock (_mutex)
        {
            if (!_store.TryGetValue(key, out var entry))
            {
                _store[key] = new Entry(State.Pending);
                return null; // this caller is the owner
            }

            // Wait until the in-flight request finishes (or the store is cleared)
            while (entry.State == State.Pending)
            {
                Monitor.Wait(_mutex);
                if (!_store.TryGetValue(key, out entry))
                    throw new OperationCanceledException(); // store was reset
            }

            return entry.State == State.Done
                ? entry.Result
                : throw new OperationCanceledException();
        }
    }

    public void Complete(string key, int value)
    {
        lock (_mutex)
        {
            _store[key] = new Entry(State.Done, value);
            Monitor.PulseAll(_mutex); // wake up all waiters
        }
    }

    public void Cancel(string key)
    {
        lock (_mutex)
        {
            _store[key] = new Entry(State.Cancelled);
            Monitor.PulseAll(_mutex); // wake up all waiters
        }
    }

    public void Clear()
    {
        lock (_mutex)
        {
            _store.Clear();
            Monitor.PulseAll(_mutex); // waiters wake up, see entry gone, throw
        }
    }
}
