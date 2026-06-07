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

    Console.WriteLine("key:" + key);
    var thisRand = Random.Shared.NextDouble();

    // 10% timeout
    if (thisRand < 0.1)
    {
        // Half of it, just simply slow response
        if (thisRand < 0.05)
        {
            await Task.Delay(1000, ctx.RequestAborted);
        }
        // Another half, not processed
        else
        {
            await Task.Delay(1000, ctx.RequestAborted).ConfigureAwait(false);
            return Results.StatusCode(504);
        }
    }

    var (claim, owned) = idempotencyStore.GetOrCreate(key);
    if (!owned)
    {
        Console.WriteLine("Got retry:");
        return claim.State switch
        {
            State.Done => Results.Ok(new { value = claim.Result, @cached = true }),
            State.Cancelled => Results.StatusCode(503),
            _ => Results.Conflict(),
        };
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

    public (Entry entry, bool owned) GetOrCreate(string key)
    {
        var fresh = new Entry();
        var entry = _store.GetOrAdd(key, fresh);
        return (entry, ReferenceEquals(entry, fresh));
    }

    public void Complete(Entry claim, int value)
    {
        lock (claim)
        {
            if (claim.State != State.Pending) return; // lost race with Clear()
            claim.Result = value;
            claim.State = State.Done;
        }
    }

    public void Cancel(Entry claim)
    {
        lock (claim)
        {
            if (claim.State != State.Pending) return;
            claim.State = State.Cancelled;
        }
    }

    public void Clear()
    {
        var entries = _store.Values.ToList();
        _store.Clear();
        foreach (var entry in entries)
            lock (entry)
                entry.State = State.Cancelled;
    }
}
