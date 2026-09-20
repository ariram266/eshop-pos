using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:9100");
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins("http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton<AgentState>();
builder.Services.AddSingleton<LocalStore>();
builder.Services.AddSingleton<MockReceiptPrinter>();
builder.Services.AddSingleton<IReceiptPrinter>(services => services.GetRequiredService<MockReceiptPrinter>());
builder.Services.AddSingleton<PrintQueue>();
builder.Services.AddHostedService<PrintWorker>();

var app = builder.Build();
app.UseCors();
app.MapGet("/health", (AgentState state) => Results.Ok(new { status = "ok", service = "pos-agent", devices = state.Devices }));
app.MapGet("/devices", (AgentState state) => Results.Ok(state.Devices));
app.MapGet("/printers", (AgentState state) => Results.Ok(state.Devices.Where(device => device.Type == "printer")));
app.MapGet("/local/products", (LocalStore store) => Results.Ok(store.Products()));
app.MapGet("/local/orders", (LocalStore store) => Results.Ok(store.Orders()));
app.MapPost("/local/catalog", (IReadOnlyList<LocalProduct> products, LocalStore store) => Results.Ok(new { accepted = store.ReplaceCatalog(products) }));
app.MapPost("/local/orders", (LocalOrder order, LocalStore store) => store.AddOrder(order) ? Results.Created($"/local/orders/{order.Id}", order) : Results.Conflict(new { error = "Order already queued" }));
app.MapPost("/local/sync/mark", (SyncMark mark, LocalStore store) => Results.Ok(store.MarkSynced(mark.OrderIds)));
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
public sealed record LocalProduct(int Id, string Sku, string Name, string Category, decimal Price, string Unit, decimal Stock, bool Active, string InventoryMode);
public sealed record LocalOrder(Guid Id, string OrderNumber, string RegisterId, string PaymentMethod, decimal Total, string Status, DateTimeOffset CreatedAt, IReadOnlyList<LocalOrderLine> Lines);
public sealed record LocalOrderLine(int ProductId, string Name, int Quantity, decimal UnitPrice);
public sealed record SyncMark(IReadOnlyList<Guid> OrderIds);
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

public sealed class LocalStore
{
    private readonly string _connectionString;
    public LocalStore(IHostEnvironment environment)
    {
        var path = Path.Combine(environment.ContentRootPath, "counterpoint-local.db");
        _connectionString = $"Data Source={path}";
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, sku TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, price NUMERIC NOT NULL, unit TEXT NOT NULL, stock NUMERIC NOT NULL, active INTEGER NOT NULL, inventory_mode TEXT NOT NULL); CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, order_number TEXT NOT NULL, register_id TEXT NOT NULL, payment_method TEXT NOT NULL, total NUMERIC NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS order_lines(order_id TEXT NOT NULL, product_id INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price NUMERIC NOT NULL);";
        command.ExecuteNonQuery();
    }
    public IReadOnlyList<LocalProduct> Products() => Query("SELECT id,sku,name,category,price,unit,stock,active,inventory_mode FROM products ORDER BY name", reader => new LocalProduct(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetDecimal(4), reader.GetString(5), reader.GetDecimal(6), reader.GetBoolean(7), reader.GetString(8)));
    public IReadOnlyList<LocalOrder> Orders()
    {
        using var connection = Open(); using var command = connection.CreateCommand(); command.CommandText = "SELECT id,order_number,register_id,payment_method,total,status,created_at FROM orders ORDER BY created_at DESC"; using var reader = command.ExecuteReader(); var orders = new List<LocalOrder>(); while (reader.Read()) orders.Add(new LocalOrder(Guid.Parse(reader.GetString(0)), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetDecimal(4), reader.GetString(5), DateTimeOffset.Parse(reader.GetString(6)), [])); reader.Close();
        for (var index = 0; index < orders.Count; index++) { var order = orders[index]; using var lines = connection.CreateCommand(); lines.CommandText = "SELECT product_id,name,quantity,unit_price FROM order_lines WHERE order_id=@id"; Add(lines, "id", order.Id.ToString()); using var lineReader = lines.ExecuteReader(); var items = new List<LocalOrderLine>(); while (lineReader.Read()) items.Add(new LocalOrderLine(lineReader.GetInt32(0), lineReader.GetString(1), lineReader.GetInt32(2), lineReader.GetDecimal(3))); orders[index] = order with { Lines = items }; }
        return orders;
    }
    public int ReplaceCatalog(IReadOnlyList<LocalProduct> products)
    {
        using var connection = Open(); using var transaction = connection.BeginTransaction();
        foreach (var product in products) { using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "INSERT INTO products(id,sku,name,category,price,unit,stock,active,inventory_mode) VALUES(@id,@sku,@name,@category,@price,@unit,@stock,@active,@mode) ON CONFLICT(id) DO UPDATE SET sku=@sku,name=@name,category=@category,price=@price,unit=@unit,stock=@stock,active=@active,inventory_mode=@mode"; Add(command, "id", product.Id); Add(command, "sku", product.Sku); Add(command, "name", product.Name); Add(command, "category", product.Category); Add(command, "price", product.Price); Add(command, "unit", product.Unit); Add(command, "stock", product.Stock); Add(command, "active", product.Active); Add(command, "mode", product.InventoryMode); command.ExecuteNonQuery(); }
        transaction.Commit(); return products.Count;
    }
    public bool AddOrder(LocalOrder order)
    {
        using var connection = Open(); using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "INSERT OR IGNORE INTO orders(id,order_number,register_id,payment_method,total,status,created_at) VALUES(@id,@number,@register,@payment,@total,@status,@created)"; Add(command, "id", order.Id.ToString()); Add(command, "number", order.OrderNumber); Add(command, "register", order.RegisterId); Add(command, "payment", order.PaymentMethod); Add(command, "total", order.Total); Add(command, "status", "queued"); Add(command, "created", order.CreatedAt.ToString("O")); var inserted = command.ExecuteNonQuery() == 1; if (inserted) foreach (var line in order.Lines) { using var item = connection.CreateCommand(); item.Transaction = transaction; item.CommandText = "INSERT INTO order_lines(order_id,product_id,name,quantity,unit_price) VALUES(@order,@product,@name,@quantity,@price)"; Add(item, "order", order.Id.ToString()); Add(item, "product", line.ProductId); Add(item, "name", line.Name); Add(item, "quantity", line.Quantity); Add(item, "price", line.UnitPrice); item.ExecuteNonQuery(); } transaction.Commit(); return inserted;
    }
    public int MarkSynced(IReadOnlyList<Guid> ids) { using var connection = Open(); var count = 0; foreach (var id in ids) { using var command = connection.CreateCommand(); command.CommandText = "UPDATE orders SET status='synced' WHERE id=@id"; Add(command, "id", id.ToString()); count += command.ExecuteNonQuery(); } return count; }
    private SqliteConnection Open() { var connection = new SqliteConnection(_connectionString); connection.Open(); return connection; }
    private IReadOnlyList<T> Query<T>(string sql, Func<SqliteDataReader, T> map) { using var connection = Open(); using var command = connection.CreateCommand(); command.CommandText = sql; using var reader = command.ExecuteReader(); var result = new List<T>(); while (reader.Read()) result.Add(map(reader)); return result; }
    private static void Add(SqliteCommand command, string name, object value) => command.Parameters.AddWithValue($"@{name}", value);
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