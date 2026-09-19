using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:9100");
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins("http://127.0.0.1:5173", "http://127.0.0.1:5174").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton<AgentState>();
builder.Services.AddSingleton<MockReceiptPrinter>();
builder.Services.AddSingleton<IReceiptPrinter>(services => services.GetRequiredService<MockReceiptPrinter>());
builder.Services.AddSingleton<PrintQueue>();
builder.Services.AddHostedService<PrintWorker>();

var app = builder.Build();
app.UseCors();
app.MapGet("/health", (AgentState state) => Results.Ok(new { status = "ok", service = "pos-agent", devices = state.Devices }));
app.MapGet("/devices", (AgentState state) => Results.Ok(state.Devices));
app.MapGet("/printers", (AgentState state) => Results.Ok(state.Devices.Where(device => device.Type == "printer")));
app.MapPost("/print", async (Receipt receipt, PrintQueue queue, CancellationToken cancellationToken) =>
{
    await queue.EnqueueAsync(receipt, cancellationToken);
    return Results.Accepted(value: new { receipt.Id, status = "queued" });
});
app.MapGet("/receipts/{id:guid}", (Guid id, [FromServices] MockReceiptPrinter printer) => printer.GetReceipt(id) is { } receipt ? Results.Text(receipt, "text/plain") : Results.NotFound());
app.MapPost("/scanner/start", () => Results.Ok(new { status = "listening" }));
app.MapPost("/cash-drawer/open", () => Results.Ok(new { status = "opened" }));
app.MapGet("/scale", () => Results.Ok(new { weight = 0m, unit = "kg", status = "ready" }));

app.Run();

public sealed record Device(string Id, string Name, string Type, string Status);
public sealed record Receipt(Guid Id, string StoreId, string RegisterId, IReadOnlyList<ReceiptLine> Lines, decimal Total);
public sealed record ReceiptLine(string Name, int Quantity, decimal UnitPrice);
public sealed class AgentState
{
    public IReadOnlyList<Device> Devices { get; } =
    [
        new("printer-01", "Mock thermal printer", "printer", "ready"),
        new("scanner-01", "Mock barcode scanner", "scanner", "ready"),
        new("drawer-01", "Mock cash drawer", "cash-drawer", "ready"),
        new("scale-01", "Mock scale", "scale", "ready")
    ];
}

public interface IReceiptPrinter
{
    Task PrintAsync(Receipt receipt, CancellationToken cancellationToken);
}

public sealed class MockReceiptPrinter : IReceiptPrinter
{
    private readonly ILogger<MockReceiptPrinter> _logger;
    private readonly string _receiptDirectory = Path.Combine(AppContext.BaseDirectory, "receipts");
    public MockReceiptPrinter(ILogger<MockReceiptPrinter> logger) { _logger = logger; Directory.CreateDirectory(_receiptDirectory); }
    public Task PrintAsync(Receipt receipt, CancellationToken cancellationToken)
    {
        var lines = string.Join(Environment.NewLine, receipt.Lines.Select(line => $"{line.Quantity} x {line.Name}  {line.UnitPrice:C}"));
        File.WriteAllText(Path.Combine(_receiptDirectory, $"{receipt.Id}.txt"), $"COUNTERPOINT POS{Environment.NewLine}Order: {receipt.StoreId}{Environment.NewLine}Register: {receipt.RegisterId}{Environment.NewLine}{Environment.NewLine}{lines}{Environment.NewLine}{Environment.NewLine}TOTAL: {receipt.Total:C}{Environment.NewLine}");
        _logger.LogInformation("Mock receipt printed: {ReceiptId}, {LineCount} lines, total {Total}", receipt.Id, receipt.Lines.Count, receipt.Total);
        return Task.CompletedTask;
    }
    public string? GetReceipt(Guid id) { var path = Path.Combine(_receiptDirectory, $"{id}.txt"); return File.Exists(path) ? File.ReadAllText(path) : null; }
}

public sealed class PrintQueue
{
    private readonly Channel<Receipt> _channel = Channel.CreateUnbounded<Receipt>();
    public ValueTask EnqueueAsync(Receipt receipt, CancellationToken cancellationToken) => _channel.Writer.WriteAsync(receipt, cancellationToken);
    public IAsyncEnumerable<Receipt> ReadAllAsync(CancellationToken cancellationToken) => _channel.Reader.ReadAllAsync(cancellationToken);
}

public sealed class PrintWorker : BackgroundService
{
    private readonly PrintQueue _queue;
    private readonly IReceiptPrinter _printer;
    private readonly ILogger<PrintWorker> _logger;
    public PrintWorker(PrintQueue queue, IReceiptPrinter printer, ILogger<PrintWorker> logger) => (_queue, _printer, _logger) = (queue, printer, logger);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var receipt in _queue.ReadAllAsync(stoppingToken))
        {
            try { await _printer.PrintAsync(receipt, stoppingToken); }
            catch (Exception exception) { _logger.LogError(exception, "Receipt printing failed for {ReceiptId}", receipt.Id); }
        }
    }
}