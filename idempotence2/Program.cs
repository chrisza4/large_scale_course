using System.Collections.Concurrent;

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

    var claim = idempotencyStore.GetCachedOrNew(key);

    if (claim.State == State.Done)
    {
        return Results.Ok(new { value = claim.Result, @cached = true });
    }
    if (claim.State == State.Cancelled)
    {
        return Results.StatusCode(503);
    }

    try
    {
        int result;
        lock (counterLock)
        {
            counter++;
            result = counter;
        }
        idempotencyStore.Complete(claim, result);
        return Results.Ok(new { value = result, @cached = false });
    }
    catch
    {
        idempotencyStore.Cancel(claim);
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
internal enum State { Pending, Done, Cancelled }

internal class Entry
{
    public State State = State.Pending;
    public int Result;
}

class IdempotencyStore
{

    private readonly ConcurrentDictionary<string, Entry> _store = new();

    public Entry GetCachedOrNew(string key)
    {
        var newEntry = new Entry();
        var entry = _store.GetOrAdd(key, newEntry);

        if (ReferenceEquals(entry, newEntry))
            return newEntry; // we're the owner

        lock (entry)
        {
            while (entry.State == State.Pending)
                Monitor.Wait(entry);
        }

        return entry;
    }

    public void Complete(Entry claim, int value)
    {
        lock (claim)
        {
            if (claim.State != State.Pending) return; // lost race with Clear()
            claim.State = State.Done;
            claim.Result = value;
            Monitor.PulseAll(claim);
        }
    }

    public void Cancel(Entry claim)
    {
        lock (claim)
        {
            if (claim.State != State.Pending) return;
            claim.State = State.Cancelled;
            Monitor.PulseAll(claim);
        }
    }

    public void Clear()
    {
        var entries = _store.Values.ToList();
        _store.Clear();
        foreach (var entry in entries)
            lock (entry)
            {
                entry.State = State.Cancelled;
                Monitor.PulseAll(entry);
            }
    }
}
