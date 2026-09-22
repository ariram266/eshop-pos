using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;

namespace Counterpoint.CloudApi.Domain;

public sealed class OperationsService(SqlConnectionFactory connections)
{
    public async Task<IReadOnlyList<SupplierDto>> GetSuppliersAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT Id,Code,Name,Email,Phone,Active FROM Suppliers WHERE OrganizationId=@org ORDER BY Name;", connection); command.Parameters.AddWithValue("org", actor.OrganizationId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<SupplierDto>(); while (await reader.ReadAsync(cancellationToken)) result.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetBoolean(5))); return result;
    }

    public async Task<SupplierDto> CreateSupplierAsync(ActorContext actor, CreateSupplierRequest input, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Code) || string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("Supplier code and name are required.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); var id = Guid.NewGuid();
        await using var command = new SqlCommand("INSERT INTO Suppliers (Id,OrganizationId,Code,Name,Email,Phone) VALUES (@id,@org,@code,@name,@email,@phone);", connection);
        command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("code", input.Code.Trim()); command.Parameters.AddWithValue("name", input.Name.Trim()); command.Parameters.AddWithValue("email", (object?)input.Email ?? DBNull.Value); command.Parameters.AddWithValue("phone", (object?)input.Phone ?? DBNull.Value); await command.ExecuteNonQueryAsync(cancellationToken); return new(id, input.Code.Trim(), input.Name.Trim(), input.Email, input.Phone, true);
    }

    public async Task<SupplierDto> UpdateSupplierAsync(ActorContext actor, Guid supplierId, UpdateSupplierRequest input, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Code) || string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("Supplier code and name are required.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("UPDATE Suppliers SET Code=@code,Name=@name,Email=@email,Phone=@phone,Active=@active WHERE Id=@id AND OrganizationId=@org;", connection);
        command.Parameters.AddWithValue("id", supplierId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("code", input.Code.Trim()); command.Parameters.AddWithValue("name", input.Name.Trim()); command.Parameters.AddWithValue("email", (object?)input.Email ?? DBNull.Value); command.Parameters.AddWithValue("phone", (object?)input.Phone ?? DBNull.Value); command.Parameters.AddWithValue("active", input.Active);
        if (await command.ExecuteNonQueryAsync(cancellationToken) == 0) throw new KeyNotFoundException("Supplier was not found.");
        return new(supplierId, input.Code.Trim(), input.Name.Trim(), input.Email, input.Phone, input.Active);
    }

    public async Task<IReadOnlyList<PurchaseDto>> GetPurchasesAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT TOP 100 pu.Id,pu.Reference,pu.SupplierId,s.Name,pu.LocationId,pu.Status,pu.CreatedAt,pl.ProductId,p.Name,pl.Quantity,pl.UnitCost,pl.BatchNumber,pl.ExpiryDate FROM Purchases pu JOIN Suppliers s ON s.Id=pu.SupplierId LEFT JOIN PurchaseLines pl ON pl.PurchaseId=pu.Id JOIN Products p ON p.Id=pl.ProductId WHERE pu.OrganizationId=@org AND pu.LocationId=@location ORDER BY pu.CreatedAt DESC;";
        await using var command = new SqlCommand(sql, connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<PurchaseDto>();
        var byId = new Dictionary<Guid, (string Reference, Guid SupplierId, string SupplierName, Guid LocationId, string Status, DateTimeOffset CreatedAt, List<PurchaseLineDto> Lines)>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetGuid(0); if (!byId.TryGetValue(id, out var purchase)) purchase = (reader.GetString(1), reader.GetGuid(2), reader.GetString(3), reader.GetGuid(4), reader.GetString(5), reader.GetDateTimeOffset(6), []);
            purchase.Lines.Add(new(reader.GetGuid(7), reader.GetString(8), reader.GetDecimal(9), reader.GetDecimal(10), reader.IsDBNull(11) ? null : reader.GetString(11), reader.IsDBNull(12) ? null : reader.GetDateTimeOffset(12))); byId[id] = purchase;
        }
        foreach (var entry in byId) result.Add(new(entry.Key, entry.Value.Reference, entry.Value.SupplierId, entry.Value.SupplierName, entry.Value.LocationId, entry.Value.Lines.Sum(line => line.Quantity * line.UnitCost), entry.Value.Status, entry.Value.CreatedAt, entry.Value.Lines));
        return result;
    }

    public async Task<Guid> ReceivePurchaseAsync(ActorContext actor, CreatePurchaseRequest input, CancellationToken cancellationToken)
    {
        ValidatePurchase(input);
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken); var purchaseId = Guid.NewGuid();
        await using (var purchase = new SqlCommand("INSERT INTO Purchases (Id,OrganizationId,SupplierId,LocationId,Reference,Status,CreatedBy) VALUES (@id,@org,@supplier,@location,@reference,'RECEIVED',@user);", connection, transaction)) { purchase.Parameters.AddWithValue("id", purchaseId); purchase.Parameters.AddWithValue("org", actor.OrganizationId); purchase.Parameters.AddWithValue("supplier", input.SupplierId); purchase.Parameters.AddWithValue("location", actor.LocationId); purchase.Parameters.AddWithValue("reference", input.Reference.Trim()); purchase.Parameters.AddWithValue("user", actor.UserId); await purchase.ExecuteNonQueryAsync(cancellationToken); }
        foreach (var line in input.Lines)
        {
            await using var item = new SqlCommand("IF NOT EXISTS (SELECT 1 FROM Products WHERE Id=@product AND OrganizationId=@org AND TrackInventory=1) THROW 50001, 'Only inventory-tracked products can be received.', 1; INSERT INTO PurchaseLines (Id,OrganizationId,PurchaseId,ProductId,Quantity,UnitCost,BatchNumber,ExpiryDate) VALUES (NEWID(),@org,@purchase,@product,@quantity,@cost,@batch,@expiry); INSERT INTO StockMovements (Id,OrganizationId,LocationId,ProductId,Quantity,MovementType,Source,CreatedBy) VALUES (NEWID(),@org,@location,@product,@quantity,'RECEIPT',@purchase,@user); UPDATE InventoryBalances SET OnHand=OnHand+@quantity,UpdatedAt=SYSUTCDATETIME() WHERE OrganizationId=@org AND LocationId=@location AND ProductId=@product;", connection, transaction);
            item.Parameters.AddWithValue("org", actor.OrganizationId); item.Parameters.AddWithValue("purchase", purchaseId); item.Parameters.AddWithValue("product", line.ProductId); item.Parameters.AddWithValue("location", actor.LocationId); item.Parameters.AddWithValue("quantity", line.Quantity); item.Parameters.AddWithValue("cost", line.UnitCost); item.Parameters.AddWithValue("batch", (object?)line.BatchNumber ?? DBNull.Value); item.Parameters.AddWithValue("expiry", (object?)line.ExpiryDate ?? DBNull.Value); item.Parameters.AddWithValue("user", actor.UserId); await item.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken); return purchaseId;
    }

    public async Task<Guid> UpdatePurchaseAsync(ActorContext actor, Guid purchaseId, CreatePurchaseRequest input, CancellationToken cancellationToken)
    {
        ValidatePurchase(input);
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
        var oldLines = new List<(Guid ProductId, decimal Quantity)>();
        await using (var select = new SqlCommand("SELECT ProductId,Quantity FROM PurchaseLines WHERE OrganizationId=@org AND PurchaseId=@purchase;", connection, transaction))
        {
            select.Parameters.AddWithValue("org", actor.OrganizationId); select.Parameters.AddWithValue("purchase", purchaseId); await using var reader = await select.ExecuteReaderAsync(cancellationToken); while (await reader.ReadAsync(cancellationToken)) oldLines.Add((reader.GetGuid(0), reader.GetDecimal(1)));
        }
        if (oldLines.Count == 0) throw new KeyNotFoundException("Purchase was not found.");
        foreach (var line in oldLines)
        {
            await using var reverse = new SqlCommand("UPDATE InventoryBalances SET OnHand=OnHand-@quantity,UpdatedAt=SYSUTCDATETIME() WHERE OrganizationId=@org AND LocationId=@location AND ProductId=@product AND OnHand>=@quantity;", connection, transaction);
            reverse.Parameters.AddWithValue("org", actor.OrganizationId); reverse.Parameters.AddWithValue("location", actor.LocationId); reverse.Parameters.AddWithValue("product", line.ProductId); reverse.Parameters.AddWithValue("quantity", line.Quantity); if (await reverse.ExecuteNonQueryAsync(cancellationToken) == 0) throw new InvalidOperationException("Purchase cannot be edited because inventory has already been consumed.");
            await AddMovementAsync(connection, transaction, actor, line.ProductId, -line.Quantity, purchaseId, cancellationToken);
        }
        await using (var delete = new SqlCommand("DELETE FROM PurchaseLines WHERE OrganizationId=@org AND PurchaseId=@purchase; UPDATE Purchases SET SupplierId=@supplier,Reference=@reference WHERE OrganizationId=@org AND Id=@purchase AND LocationId=@location;", connection, transaction))
        {
            delete.Parameters.AddWithValue("org", actor.OrganizationId); delete.Parameters.AddWithValue("purchase", purchaseId); delete.Parameters.AddWithValue("supplier", input.SupplierId); delete.Parameters.AddWithValue("reference", input.Reference.Trim()); delete.Parameters.AddWithValue("location", actor.LocationId); if (await delete.ExecuteNonQueryAsync(cancellationToken) < 1) throw new KeyNotFoundException("Purchase was not found.");
        }
        foreach (var line in input.Lines)
        {
            await using var item = new SqlCommand("IF NOT EXISTS (SELECT 1 FROM Products WHERE Id=@product AND OrganizationId=@org AND TrackInventory=1) THROW 50001, 'Only inventory-tracked products can be received.', 1; INSERT INTO PurchaseLines (Id,OrganizationId,PurchaseId,ProductId,Quantity,UnitCost,BatchNumber,ExpiryDate) VALUES (NEWID(),@org,@purchase,@product,@quantity,@cost,@batch,@expiry); UPDATE InventoryBalances SET OnHand=OnHand+@quantity,UpdatedAt=SYSUTCDATETIME() WHERE OrganizationId=@org AND LocationId=@location AND ProductId=@product;", connection, transaction);
            item.Parameters.AddWithValue("org", actor.OrganizationId); item.Parameters.AddWithValue("purchase", purchaseId); item.Parameters.AddWithValue("product", line.ProductId); item.Parameters.AddWithValue("location", actor.LocationId); item.Parameters.AddWithValue("quantity", line.Quantity); item.Parameters.AddWithValue("cost", line.UnitCost); item.Parameters.AddWithValue("batch", (object?)line.BatchNumber ?? DBNull.Value); item.Parameters.AddWithValue("expiry", (object?)line.ExpiryDate ?? DBNull.Value); await item.ExecuteNonQueryAsync(cancellationToken); await AddMovementAsync(connection, transaction, actor, line.ProductId, line.Quantity, purchaseId, cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken); return purchaseId;
    }

    private static void ValidatePurchase(CreatePurchaseRequest input)
    {
        if (input.Lines.Count == 0 || string.IsNullOrWhiteSpace(input.Reference) || input.Lines.Any(line => line.Quantity <= 0 || line.UnitCost < 0)) throw new ArgumentException("Purchase reference and positive purchase lines are required.");
    }

    private static async Task AddMovementAsync(SqlConnection connection, SqlTransaction transaction, ActorContext actor, Guid productId, decimal quantity, Guid purchaseId, CancellationToken cancellationToken)
    {
        await using var movement = new SqlCommand("INSERT INTO StockMovements (Id,OrganizationId,LocationId,ProductId,Quantity,MovementType,Source,CreatedBy) VALUES (NEWID(),@org,@location,@product,@quantity,'PURCHASE_EDIT',@source,@user);", connection, transaction);
        movement.Parameters.AddWithValue("org", actor.OrganizationId); movement.Parameters.AddWithValue("location", actor.LocationId); movement.Parameters.AddWithValue("product", productId); movement.Parameters.AddWithValue("quantity", quantity); movement.Parameters.AddWithValue("source", purchaseId.ToString()); movement.Parameters.AddWithValue("user", actor.UserId); await movement.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<InventorySummaryDto>> GetInventoryAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); const string sql = "SELECT p.Id,p.Sku,p.Name,ib.OnHand,CAST(0 AS decimal(19,4)),ib.OnHand,ib.ReorderLevel,CASE WHEN ib.OnHand <= ib.ReorderLevel THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END FROM InventoryBalances ib JOIN Products p ON p.Id=ib.ProductId WHERE ib.OrganizationId=@org AND ib.LocationId=@location AND p.TrackInventory=1 ORDER BY p.Name;"; await using var command = new SqlCommand(sql, connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<InventorySummaryDto>(); while (await reader.ReadAsync(cancellationToken)) result.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetDecimal(3), reader.GetDecimal(4), reader.GetDecimal(5), reader.GetDecimal(6), reader.GetBoolean(7))); return result;
    }

    public async Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); const string sql = "SELECT TOP 300 sm.Id,sm.ProductId,p.Name,sm.Quantity,sm.MovementType,sm.Source,sm.CreatedAt FROM StockMovements sm JOIN Products p ON p.Id=sm.ProductId WHERE sm.OrganizationId=@org AND sm.LocationId=@location ORDER BY sm.CreatedAt DESC;"; await using var command = new SqlCommand(sql, connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<StockMovementDto>(); while (await reader.ReadAsync(cancellationToken)) result.Add(new(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetDecimal(3), reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetDateTimeOffset(6))); return result;
    }

    public async Task<IReadOnlyList<SalesHistoryDto>> GetSalesAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); const string sql = "SELECT TOP 100 o.Id,o.OrderNumber,o.Total,o.Status,CASE WHEN EXISTS(SELECT 1 FROM Payments p WHERE p.OrderId=o.Id AND p.Status='PAID') THEN 'PAID' ELSE 'PENDING' END,o.CreatedAt,oi.ProductId,p.Name,c.Name,p.HsnCode,p.GstRate,p.CgstRate,p.SgstRate,oi.Quantity,oi.UnitPrice,oi.TaxAmount FROM Orders o JOIN OrderItems oi ON oi.OrderId=o.Id JOIN Products p ON p.Id=oi.ProductId JOIN Categories c ON c.Id=p.CategoryId WHERE o.OrganizationId=@org AND o.LocationId=@location ORDER BY o.CreatedAt DESC,o.OrderNumber;"; await using var command = new SqlCommand(sql, connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<SalesHistoryDto>(); var byId = new Dictionary<Guid, (string Number, decimal Total, string Status, string Payment, DateTimeOffset CreatedAt, List<SalesHistoryLineDto> Lines)>(); while (await reader.ReadAsync(cancellationToken)) { var id = reader.GetGuid(0); if (!byId.TryGetValue(id, out var sale)) sale = (reader.GetString(1), reader.GetDecimal(2), reader.GetString(3), reader.GetString(4), reader.GetDateTimeOffset(5), []); sale.Lines.Add(new(reader.GetGuid(6), reader.GetString(7), reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetString(9), reader.GetDecimal(10), reader.GetDecimal(11), reader.GetDecimal(12), reader.GetDecimal(13), reader.GetDecimal(14), reader.GetDecimal(15))); byId[id] = sale; } foreach (var entry in byId) result.Add(new(entry.Key, entry.Value.Number, entry.Value.Total, entry.Value.Status, entry.Value.Payment, entry.Value.CreatedAt, entry.Value.Lines)); return result;
    }

    public async Task<SalesSummaryDto> GetSalesSummaryAsync(ActorContext actor, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); await using var command = new SqlCommand("SELECT COUNT(*),COALESCE(SUM(Total),0),COALESCE(SUM(Tax),0) FROM Orders WHERE OrganizationId=@org AND LocationId=@location AND CreatedAt>=@from AND CreatedAt<@to;", connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); command.Parameters.AddWithValue("from", from); command.Parameters.AddWithValue("to", to); await using var reader = await command.ExecuteReaderAsync(cancellationToken); await reader.ReadAsync(cancellationToken); var count = reader.GetInt32(0); var gross = reader.GetDecimal(1); var tax = reader.GetDecimal(2); return new(count, gross, tax, gross - tax, from, to);
    }
}
