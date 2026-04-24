using System.Text.Json;
using Azure.Identity;
using Azure.Messaging.ServiceBus;
using Npgsql;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

// Checkout service — places orders.
//   1. Persists order header + lines to Postgres (database `orders`)
//      via Entra ID auth (no passwords).
//   2. Calls payment-service to authorize.
//   3. Publishes "OrderPlaced" to Service Bus topic `orders` for inventory.
//
// Demo Act 1: when feature flag `checkoutCrashOnStart=true`, /readyz exits the
// process — the kubelet then crashloops the pod.

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();

var serviceName = "checkout-service";
if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT")))
{
    builder.Services.AddOpenTelemetry()
        .ConfigureResource(r => r.AddService(serviceName))
        .WithTracing(t => t
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddSource("Azure.*")
            .AddOtlpExporter());
}

builder.Services.AddHttpClient("payment", c =>
{
    c.BaseAddress = new Uri(Environment.GetEnvironmentVariable("PAYMENT_BASE") ?? "http://payment-service:8080");
    c.Timeout = TimeSpan.FromSeconds(5);
});

builder.Services.AddSingleton<NpgsqlDataSource>(_ =>
{
    var host = Environment.GetEnvironmentVariable("PGHOST")
        ?? throw new InvalidOperationException("PGHOST not set");
    var db = Environment.GetEnvironmentVariable("PGDATABASE") ?? "orders";
    var user = Environment.GetEnvironmentVariable("PGUSER")
        ?? throw new InvalidOperationException("PGUSER not set");
    var port = int.Parse(Environment.GetEnvironmentVariable("PGPORT") ?? "5432");

    var cs = new NpgsqlConnectionStringBuilder
    {
        Host = host,
        Database = db,
        Username = user,
        Port = port,
        SslMode = SslMode.Require,
        Pooling = true,
        MinPoolSize = 1,
        MaxPoolSize = 10,
    };
    var dsBuilder = new NpgsqlDataSourceBuilder(cs.ConnectionString);
    var cred = new DefaultAzureCredential();
    dsBuilder.UsePeriodicPasswordProvider(async (_, ct) =>
    {
        var tok = await cred.GetTokenAsync(
            new Azure.Core.TokenRequestContext(new[] { "https://ossrdbms-aad.database.windows.net/.default" }), ct);
        return tok.Token;
    }, TimeSpan.FromMinutes(50), TimeSpan.FromSeconds(5));
    return dsBuilder.Build();
});

builder.Services.AddSingleton<ServiceBusClient>(_ =>
{
    var fqdn = Environment.GetEnvironmentVariable("SERVICEBUS_FQDN")
        ?? throw new InvalidOperationException("SERVICEBUS_FQDN not set");
    return new ServiceBusClient(fqdn, new DefaultAzureCredential());
});

builder.Services.AddSingleton<ServiceBusSender>(sp =>
{
    var topic = Environment.GetEnvironmentVariable("SERVICEBUS_TOPIC") ?? "orders";
    return sp.GetRequiredService<ServiceBusClient>().CreateSender(topic);
});

builder.Services.AddSingleton<FlagClient>();
builder.Services.AddHostedService<SchemaInitializer>();

var app = builder.Build();

app.MapGet("/healthz", () => Results.Json(new { status = "ok" }));

app.MapGet("/readyz", async (FlagClient flags, NpgsqlDataSource ds, ILogger<Program> log) =>
{
    if (await flags.IsOnAsync("checkoutCrashOnStart"))
    {
        log.LogCritical("crashing per feature flag checkoutCrashOnStart");
        Environment.Exit(137);
    }
    await using var conn = await ds.OpenConnectionAsync();
    return Results.Json(new { status = "ready" });
});

app.MapPost("/checkout", async (
    PlaceOrderRequest req,
    IHttpClientFactory http,
    NpgsqlDataSource ds,
    ServiceBusSender bus,
    ILogger<Program> log) =>
{
    if (req.Items is null || req.Items.Count == 0)
        return Results.BadRequest(new { error = "empty cart" });

    var orderId = Guid.NewGuid().ToString("N")[..16];
    var totalCents = req.Items.Sum(i => i.PriceCents * i.Qty);

    // 1) Authorize payment
    var pay = http.CreateClient("payment");
    var payResp = await pay.PostAsJsonAsync("/charge", new
    {
        pan = req.Card.Pan,
        currency = "USD",
        amountCents = totalCents,
        orderId
    });
    var charge = await payResp.Content.ReadFromJsonAsync<ChargeResponse>();
    if (!payResp.IsSuccessStatusCode || charge is null || !charge.Approved)
    {
        log.LogWarning("payment failed {Order}", orderId);
        return Results.Json(new { orderId, status = "declined" }, statusCode: 402);
    }

    // 2) Persist order
    await using (var conn = await ds.OpenConnectionAsync())
    await using (var tx = await conn.BeginTransactionAsync())
    {
        await using (var cmd = new NpgsqlCommand(
            "INSERT INTO orders (order_id, user_id, total_cents, currency, auth_code, status) " +
            "VALUES ($1, $2, $3, 'USD', $4, 'PLACED')", conn, tx))
        {
            cmd.Parameters.AddWithValue(orderId);
            cmd.Parameters.AddWithValue(req.UserId);
            cmd.Parameters.AddWithValue(totalCents);
            cmd.Parameters.AddWithValue(charge.AuthCode ?? "");
            await cmd.ExecuteNonQueryAsync();
        }
        foreach (var it in req.Items)
        {
            await using var cmd = new NpgsqlCommand(
                "INSERT INTO order_lines (order_id, sku, qty, unit_price_cents) VALUES ($1, $2, $3, $4)",
                conn, tx);
            cmd.Parameters.AddWithValue(orderId);
            cmd.Parameters.AddWithValue(it.Sku);
            cmd.Parameters.AddWithValue(it.Qty);
            cmd.Parameters.AddWithValue(it.PriceCents);
            await cmd.ExecuteNonQueryAsync();
        }
        await tx.CommitAsync();
    }

    // 3) Publish event
    var evt = JsonSerializer.Serialize(new
    {
        orderId,
        userId = req.UserId,
        items = req.Items.Select(i => new { sku = i.Sku, qty = i.Qty })
    });
    await bus.SendMessageAsync(new ServiceBusMessage(evt) { ContentType = "application/json" });

    log.LogInformation("order placed {Order} {Cents}", orderId, totalCents);
    return Results.Json(new { orderId, status = "placed", authCode = charge.AuthCode, totalCents });
});

app.MapGet("/orders/{id}", async (string id, NpgsqlDataSource ds) =>
{
    await using var conn = await ds.OpenConnectionAsync();
    await using var cmd = new NpgsqlCommand(
        "SELECT order_id, user_id, total_cents, currency, status, created_at FROM orders WHERE order_id = $1", conn);
    cmd.Parameters.AddWithValue(id);
    await using var rdr = await cmd.ExecuteReaderAsync();
    if (!await rdr.ReadAsync()) return Results.NotFound();
    return Results.Json(new
    {
        orderId = rdr.GetString(0),
        userId = rdr.GetString(1),
        totalCents = rdr.GetInt32(2),
        currency = rdr.GetString(3),
        status = rdr.GetString(4),
        createdAt = rdr.GetDateTime(5)
    });
});

app.Run();

record CardInfo(string Pan);
record OrderLine(string Sku, int Qty, int PriceCents);
record PlaceOrderRequest(string UserId, CardInfo Card, List<OrderLine> Items);
record ChargeResponse(bool Approved, string? AuthCode, string? DeclineReason);

class FlagClient
{
    private readonly HttpClient _h;
    public FlagClient(IHttpClientFactory f)
    {
        _h = f.CreateClient();
        _h.BaseAddress = new Uri(Environment.GetEnvironmentVariable("FLAGS_BASE") ?? "http://feature-flags:8080");
        _h.Timeout = TimeSpan.FromSeconds(1);
    }
    public async Task<bool> IsOnAsync(string name)
    {
        try
        {
            var r = await _h.GetFromJsonAsync<JsonElement>($"/flags/{name}");
            return r.TryGetProperty("value", out var v) && v.GetBoolean();
        }
        catch { return false; }
    }
}

class SchemaInitializer : IHostedService
{
    private readonly NpgsqlDataSource _ds;
    private readonly ILogger<SchemaInitializer> _log;
    public SchemaInitializer(NpgsqlDataSource ds, ILogger<SchemaInitializer> log) { _ds = ds; _log = log; }
    public async Task StartAsync(CancellationToken ct)
    {
        try
        {
            await using var conn = await _ds.OpenConnectionAsync(ct);
            await using var cmd = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS orders (
                  order_id TEXT PRIMARY KEY,
                  user_id TEXT NOT NULL,
                  total_cents INTEGER NOT NULL,
                  currency TEXT NOT NULL,
                  auth_code TEXT,
                  status TEXT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS order_lines (
                  order_id TEXT REFERENCES orders(order_id) ON DELETE CASCADE,
                  sku TEXT NOT NULL,
                  qty INTEGER NOT NULL,
                  unit_price_cents INTEGER NOT NULL,
                  PRIMARY KEY (order_id, sku)
                );", conn);
            await cmd.ExecuteNonQueryAsync(ct);
            _log.LogInformation("orders schema ready");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "schema init failed (will retry on first request)");
        }
    }
    public Task StopAsync(CancellationToken _) => Task.CompletedTask;
}
