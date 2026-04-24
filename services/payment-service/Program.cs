using System.Text.Json;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

// Payment service — mock card processor. Returns auth code for any non-empty
// PAN (last4 stored, full PAN never logged). Random 1% decline to keep the
// failure-rate dashboard interesting.

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(o => { o.IncludeScopes = true; });

var serviceName = "payment-service";
var otlp = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
if (!string.IsNullOrWhiteSpace(otlp))
{
    builder.Services.AddOpenTelemetry()
        .ConfigureResource(r => r.AddService(serviceName))
        .WithTracing(t => t
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddOtlpExporter());
}

var app = builder.Build();

app.MapGet("/healthz", () => Results.Json(new { status = "ok" }));
app.MapGet("/readyz", () => Results.Json(new { status = "ready" }));

app.MapPost("/charge", (ChargeRequest req, ILogger<Program> log) =>
{
    if (string.IsNullOrWhiteSpace(req.Pan) || req.AmountCents <= 0)
        return Results.BadRequest(new { error = "invalid charge" });

    var last4 = req.Pan.Length >= 4 ? req.Pan[^4..] : req.Pan;
    // 1% decline rate
    if (Random.Shared.Next(100) == 0)
    {
        log.LogWarning("payment declined {Last4} {Cents}", last4, req.AmountCents);
        return Results.Json(new ChargeResponse(false, null, "card_declined"), statusCode: 402);
    }

    var auth = $"AUTH-{Guid.NewGuid():N}"[..16];
    log.LogInformation("payment authorized {Last4} {Cents} {Auth}", last4, req.AmountCents, auth);
    return Results.Json(new ChargeResponse(true, auth, null));
});

app.Run();

record ChargeRequest(string Pan, string Currency, int AmountCents, string OrderId);
record ChargeResponse(bool Approved, string? AuthCode, string? DeclineReason);
