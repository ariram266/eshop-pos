using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.CloudApi.Domain.Payment;
using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;
using System.Text.Json;

namespace Counterpoint.CloudApi.Domain;

public sealed class OrderService(SqlConnectionFactory connections, KdsService kds, IPaymentProvider payments, WebPubSubNotifier notifier)
{
    private readonly SqlConnectionFactory _connections = connections;
    private readonly KdsService _kds = kds;
    private readonly IPaymentProvider _payments = payments;
    private readonly WebPubSubNotifier _notifier = notifier;

    public async Task<PosBootstrap> GetBootstrapAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = _connections.Create();
        await connection.OpenAsync(cancellationToken);
        var categories = new List<CategoryDto>();
        var products = new List<ProductDto>();
        var modifierGroups = new List<ModifierGroupDto>();
        var modifiers = new List<ModifierDto>();
        var taxes = new List<TaxRuleDto>();
        var stations = new List<PreparationStationDto>();

        await using (var command = new SqlCommand("SELECT Id, Name FROM Categories WHERE OrganizationId=@org AND Active=1 ORDER BY Name;", connection))
        {
            command.Parameters.AddWithValue("org", actor.OrganizationId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) categories.Add(new(reader.GetGuid(0), reader.GetString(1)));
        }
        await using (var command = new SqlCommand("SELECT p.Id,p.Sku,p.Name,p.CategoryId,pp.Price,p.Unit,COALESCE(ib.OnHand,0),p.ProductType,p.PreparationStationId,COALESCE(tr.Rate,0),p.Active FROM Products p JOIN ProductPrices pp ON pp.ProductId=p.Id AND pp.LocationId=@location AND pp.Active=1 LEFT JOIN InventoryBalances ib ON ib.ProductId=p.Id AND ib.LocationId=@location LEFT JOIN TaxRules tr ON tr.Id=p.TaxRuleId WHERE p.OrganizationId=@org AND p.Active=1 ORDER BY p.Name;", connection))
        {
            command.Parameters.AddWithValue("org", actor.OrganizationId);
            command.Parameters.AddWithValue("location", actor.LocationId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) products.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetGuid(3), reader.GetDecimal(4), reader.GetString(5), reader.GetDecimal(6), reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetGuid(8), reader.GetDecimal(9), reader.GetBoolean(10)));
        }
        await using (var command = new SqlCommand("SELECT Id,Name,Rate FROM TaxRules WHERE OrganizationId=@org AND Active=1;", connection))
        {
            command.Parameters.AddWithValue("org", actor.OrganizationId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) taxes.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetDecimal(2)));
        }
        await using (var command = new SqlCommand("SELECT Id,Name,Code FROM PreparationStations WHERE OrganizationId=@org AND Active=1;", connection))
        {
            command.Parameters.AddWithValue("org", actor.OrganizationId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) stations.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2)));
        }
        await using (var command = new SqlCommand("SELECT Id,Name,Required FROM ModifierGroups WHERE OrganizationId=@org AND Active=1;", connection))
        {
            command.Parameters.AddWithValue("org", actor.OrganizationId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) modifierGroups.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetBoolean(2)));
        }
        await using (var command = new SqlCommand("SELECT Id,ModifierGroupId,Name,PriceDelta FROM Modifiers WHERE OrganizationId=@org AND Active=1;", connection))
        {
            command.Parameters.AddWithValue("org", actor.OrganizationId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) modifiers.Add(new(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetDecimal(3)));
        }
        return new(categories, products, modifierGroups, modifiers, taxes, stations, actor.LocationId, "USD");
    }

    public async Task<OrderDto> CreateAsync(ActorContext actor, CreateOrderRequest input, string idempotencyKey, CancellationToken cancellationToken)
    {
        if (input.Lines.Count == 0 || string.IsNullOrWhiteSpace(idempotencyKey)) throw new ArgumentException("Order lines and Idempotency-Key are required.");
        await using var connection = _connections.Create();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
        await using (var register = new SqlCommand("SELECT 1 FROM Registers WHERE OrganizationId=@org AND LocationId=@location AND RegisterCode=@register AND Active=1;", connection, transaction))
        {
            register.Parameters.AddWithValue("org", actor.OrganizationId); register.Parameters.AddWithValue("location", actor.LocationId); register.Parameters.AddWithValue("register", input.RegisterId);
            if (await register.ExecuteScalarAsync(cancellationToken) is null) throw new InvalidOperationException("Register is not authorized for this location.");
        }
        await using (var existing = new SqlCommand("SELECT ResponseJson FROM IdempotencyKeys WITH (UPDLOCK,HOLDLOCK) WHERE OrganizationId=@org AND IdempotencyKey=@key;", connection, transaction))
        {
            existing.Parameters.AddWithValue("org", actor.OrganizationId); existing.Parameters.AddWithValue("key", idempotencyKey);
            var cached = await existing.ExecuteScalarAsync(cancellationToken);
            if (cached is string json) { await transaction.RollbackAsync(cancellationToken); return JsonSerializer.Deserialize<OrderDto>(json)!; }
        }

        var lines = new List<OrderLineDto>();
        decimal subtotal = 0;
        foreach (var requested in input.Lines)
        {
            await using var product = new SqlCommand("SELECT p.Name,pp.Price,COALESCE(ib.OnHand,0),COALESCE(tr.Rate,0),ps.Code FROM Products p JOIN ProductPrices pp ON pp.ProductId=p.Id AND pp.LocationId=@location AND pp.Active=1 LEFT JOIN InventoryBalances ib ON ib.ProductId=p.Id AND ib.LocationId=@location LEFT JOIN TaxRules tr ON tr.Id=p.TaxRuleId LEFT JOIN PreparationStations ps ON ps.Id=p.PreparationStationId WHERE p.Id=@product AND p.OrganizationId=@org AND p.Active=1;", connection, transaction);
            product.Parameters.AddWithValue("location", actor.LocationId); product.Parameters.AddWithValue("product", requested.ProductId); product.Parameters.AddWithValue("org", actor.OrganizationId);
            await using var reader = await product.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) throw new InvalidOperationException("Product is unavailable.");
            var name = reader.GetString(0); var price = reader.GetDecimal(1); var stock = reader.GetDecimal(2); var rate = reader.GetDecimal(3); var station = reader.IsDBNull(4) ? null : reader.GetString(4);
            await reader.CloseAsync();
            if (requested.Quantity <= 0 || stock < requested.Quantity) throw new InvalidOperationException($"Insufficient inventory for {name}.");
            var lineSubtotal = price * requested.Quantity; var lineTax = Math.Round(lineSubtotal * rate / 100m, 2); subtotal += lineSubtotal;
            lines.Add(new(requested.ProductId, name, requested.Quantity, price, lineTax, station));
        }
        var tax = lines.Sum(line => line.TaxAmount); var total = subtotal + tax; var orderId = Guid.NewGuid(); var number = $"{DateTimeOffset.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 10000)}";
        await using (var command = new SqlCommand("INSERT INTO Orders (Id,OrganizationId,LocationId,RegisterId,OrderNumber,Channel,OrderType,Status,Subtotal,Tax,Total,CreatedBy) VALUES (@id,@org,@location,@register,@number,'POS',@type,'PAID',@subtotal,@tax,@total,@user);", connection, transaction))
        {
            command.Parameters.AddWithValue("id", orderId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); command.Parameters.AddWithValue("register", input.RegisterId); command.Parameters.AddWithValue("number", number); command.Parameters.AddWithValue("type", input.OrderType); command.Parameters.AddWithValue("subtotal", subtotal); command.Parameters.AddWithValue("tax", tax); command.Parameters.AddWithValue("total", total); command.Parameters.AddWithValue("user", actor.UserId); await command.ExecuteNonQueryAsync(cancellationToken);
        }
        foreach (var line in lines)
        {
            await using var guardedUpdate = new SqlCommand("UPDATE InventoryBalances SET OnHand=OnHand-@quantity,UpdatedAt=SYSUTCDATETIME() WHERE OrganizationId=@org AND LocationId=@location AND ProductId=@product AND OnHand >= @quantity;", connection, transaction);
            guardedUpdate.Parameters.AddWithValue("org", actor.OrganizationId); guardedUpdate.Parameters.AddWithValue("location", actor.LocationId); guardedUpdate.Parameters.AddWithValue("product", line.ProductId); guardedUpdate.Parameters.AddWithValue("quantity", line.Quantity);
            if (await guardedUpdate.ExecuteNonQueryAsync(cancellationToken) != 1) throw new InvalidOperationException($"Insufficient inventory for {line.Name}.");
            await using var item = new SqlCommand("INSERT INTO OrderItems (Id,OrganizationId,OrderId,ProductId,Quantity,UnitPrice,TaxAmount) VALUES (@id,@org,@order,@product,@quantity,@price,@tax); INSERT INTO StockMovements (Id,OrganizationId,LocationId,ProductId,Quantity,MovementType,Source,CreatedBy) VALUES (@movement,@org,@location,@product,-@quantity,'SALE',@order,@user);", connection, transaction);
            item.Parameters.AddWithValue("id", Guid.NewGuid()); item.Parameters.AddWithValue("movement", Guid.NewGuid()); item.Parameters.AddWithValue("org", actor.OrganizationId); item.Parameters.AddWithValue("order", orderId); item.Parameters.AddWithValue("location", actor.LocationId); item.Parameters.AddWithValue("product", line.ProductId); item.Parameters.AddWithValue("quantity", line.Quantity); item.Parameters.AddWithValue("price", line.UnitPrice); item.Parameters.AddWithValue("tax", line.TaxAmount); item.Parameters.AddWithValue("user", actor.UserId); await item.ExecuteNonQueryAsync(cancellationToken);
        }
        await _payments.CaptureAsync(connection, transaction, actor, orderId, total, input.PaymentMethod, cancellationToken);
        await _kds.CreateWorkItemsAsync(connection, transaction, actor, orderId, number, lines, cancellationToken);
        var result = new OrderDto(orderId, number, "PAID", subtotal, tax, total, "PAID", lines, DateTimeOffset.UtcNow);
        await using (var command = new SqlCommand("INSERT INTO IdempotencyKeys (OrganizationId,IdempotencyKey,ResponseJson) VALUES (@org,@key,@json);", connection, transaction)) { command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("key", idempotencyKey); command.Parameters.AddWithValue("json", JsonSerializer.Serialize(result)); await command.ExecuteNonQueryAsync(cancellationToken); }
        await transaction.CommitAsync(cancellationToken);
        await _notifier.PublishOrderAsync(actor.OrganizationId, actor.LocationId, orderId, cancellationToken);
        return result;
    }
}
