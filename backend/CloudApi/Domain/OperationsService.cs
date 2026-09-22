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

    public async Task<Guid> ReceivePurchaseAsync(ActorContext actor, CreatePurchaseRequest input, CancellationToken cancellationToken)
    {
        if (input.Lines.Count == 0 || string.IsNullOrWhiteSpace(input.Reference)) throw new ArgumentException("Purchase reference and lines are required.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken); var purchaseId = Guid.NewGuid();
        await using (var purchase = new SqlCommand("INSERT INTO Purchases (Id,OrganizationId,SupplierId,LocationId,Reference,Status,CreatedBy) VALUES (@id,@org,@supplier,@location,@reference,'RECEIVED',@user);", connection, transaction)) { purchase.Parameters.AddWithValue("id", purchaseId); purchase.Parameters.AddWithValue("org", actor.OrganizationId); purchase.Parameters.AddWithValue("supplier", input.SupplierId); purchase.Parameters.AddWithValue("location", actor.LocationId); purchase.Parameters.AddWithValue("reference", input.Reference.Trim()); purchase.Parameters.AddWithValue("user", actor.UserId); await purchase.ExecuteNonQueryAsync(cancellationToken); }
        foreach (var line in input.Lines)
        {
            await using var item = new SqlCommand("INSERT INTO PurchaseLines (Id,OrganizationId,PurchaseId,ProductId,Quantity,UnitCost,BatchNumber,ExpiryDate) VALUES (NEWID(),@org,@purchase,@product,@quantity,@cost,@batch,@expiry); INSERT INTO StockMovements (Id,OrganizationId,LocationId,ProductId,Quantity,MovementType,Source,CreatedBy) VALUES (NEWID(),@org,@location,@product,@quantity,'RECEIPT',@purchase,@user); UPDATE InventoryBalances SET OnHand=OnHand+@quantity,UpdatedAt=SYSUTCDATETIME() WHERE OrganizationId=@org AND LocationId=@location AND ProductId=@product;", connection, transaction);
            item.Parameters.AddWithValue("org", actor.OrganizationId); item.Parameters.AddWithValue("purchase", purchaseId); item.Parameters.AddWithValue("product", line.ProductId); item.Parameters.AddWithValue("location", actor.LocationId); item.Parameters.AddWithValue("quantity", line.Quantity); item.Parameters.AddWithValue("cost", line.UnitCost); item.Parameters.AddWithValue("batch", (object?)line.BatchNumber ?? DBNull.Value); item.Parameters.AddWithValue("expiry", (object?)line.ExpiryDate ?? DBNull.Value); item.Parameters.AddWithValue("user", actor.UserId); await item.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken); return purchaseId;
    }

    public async Task<IReadOnlyList<InventorySummaryDto>> GetInventoryAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); const string sql = "SELECT p.Id,p.Sku,p.Name,ib.OnHand,CAST(0 AS decimal(19,4)),ib.OnHand,ib.ReorderLevel,CASE WHEN ib.OnHand <= ib.ReorderLevel THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END FROM InventoryBalances ib JOIN Products p ON p.Id=ib.ProductId WHERE ib.OrganizationId=@org AND ib.LocationId=@location ORDER BY p.Name;"; await using var command = new SqlCommand(sql, connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<InventorySummaryDto>(); while (await reader.ReadAsync(cancellationToken)) result.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetDecimal(3), reader.GetDecimal(4), reader.GetDecimal(5), reader.GetDecimal(6), reader.GetBoolean(7))); return result;
    }

    public async Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); const string sql = "SELECT TOP 300 sm.Id,sm.ProductId,p.Name,sm.Quantity,sm.MovementType,sm.Source,sm.CreatedAt FROM StockMovements sm JOIN Products p ON p.Id=sm.ProductId WHERE sm.OrganizationId=@org AND sm.LocationId=@location ORDER BY sm.CreatedAt DESC;"; await using var command = new SqlCommand(sql, connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<StockMovementDto>(); while (await reader.ReadAsync(cancellationToken)) result.Add(new(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetDecimal(3), reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetDateTimeOffset(6))); return result;
    }

    public async Task<IReadOnlyList<SalesHistoryDto>> GetSalesAsync(ActorContext actor, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); const string sql = "SELECT TOP 100 o.Id,o.OrderNumber,o.Total,o.Status,CASE WHEN EXISTS(SELECT 1 FROM Payments p WHERE p.OrderId=o.Id AND p.Status='PAID') THEN 'PAID' ELSE 'PENDING' END,o.CreatedAt FROM Orders o WHERE o.OrganizationId=@org AND o.LocationId=@location ORDER BY o.CreatedAt DESC;"; await using var command = new SqlCommand(sql, connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<SalesHistoryDto>(); while (await reader.ReadAsync(cancellationToken)) result.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetDecimal(2), reader.GetString(3), reader.GetString(4), reader.GetDateTimeOffset(5))); return result;
    }

    public async Task<SalesSummaryDto> GetSalesSummaryAsync(ActorContext actor, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); await using var command = new SqlCommand("SELECT COUNT(*),COALESCE(SUM(Total),0),COALESCE(SUM(Tax),0) FROM Orders WHERE OrganizationId=@org AND LocationId=@location AND CreatedAt>=@from AND CreatedAt<@to;", connection); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); command.Parameters.AddWithValue("from", from); command.Parameters.AddWithValue("to", to); await using var reader = await command.ExecuteReaderAsync(cancellationToken); await reader.ReadAsync(cancellationToken); var count = reader.GetInt32(0); var gross = reader.GetDecimal(1); var tax = reader.GetDecimal(2); return new(count, gross, tax, gross - tax, from, to);
    }
}
