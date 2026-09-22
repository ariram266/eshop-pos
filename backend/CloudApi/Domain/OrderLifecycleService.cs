using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;

namespace Counterpoint.CloudApi.Domain;

public sealed class OrderLifecycleService(SqlConnectionFactory connections)
{
    public async Task<OrderDto> GetAsync(ActorContext actor, Guid orderId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT Id,OrderNumber,Status,Subtotal,Tax,Total,CreatedAt FROM Orders WHERE Id=@id AND OrganizationId=@org AND LocationId=@location;", connection);
        command.Parameters.AddWithValue("id", orderId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) throw new KeyNotFoundException("Order was not found.");
        return new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetDecimal(3), reader.GetDecimal(4), reader.GetDecimal(5), "PAID", [], reader.GetDateTimeOffset(6));
    }

    public async Task<OrderDto> UpdateStatusAsync(ActorContext actor, Guid orderId, string status, CancellationToken cancellationToken)
    {
        var normalized = status.Trim().ToUpperInvariant();
        if (!new[] { "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED" }.Contains(normalized)) throw new ArgumentException("Unsupported order status.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("UPDATE Orders SET Status=@status WHERE Id=@id AND OrganizationId=@org AND LocationId=@location AND Status NOT IN ('COMPLETED','CANCELLED');", connection);
        command.Parameters.AddWithValue("status", normalized); command.Parameters.AddWithValue("id", orderId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId);
        if (await command.ExecuteNonQueryAsync(cancellationToken) != 1) throw new InvalidOperationException("Order cannot transition to the requested status.");
        return await GetAsync(actor, orderId, cancellationToken);
    }

    public async Task<OrderDto> CancelAsync(ActorContext actor, Guid orderId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
        await using var command = new SqlCommand("UPDATE Orders SET Status='CANCELLED' WHERE Id=@id AND OrganizationId=@org AND LocationId=@location AND Status NOT IN ('COMPLETED','CANCELLED');", connection, transaction);
        command.Parameters.AddWithValue("id", orderId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId);
        if (await command.ExecuteNonQueryAsync(cancellationToken) != 1) throw new InvalidOperationException("Order cannot be cancelled.");
        await using var reverse = new SqlCommand("INSERT INTO StockMovements (Id,OrganizationId,LocationId,ProductId,Quantity,MovementType,Source,CreatedBy) SELECT NEWID(),@org,@location,ProductId,Quantity,'RELEASE',@order,@user FROM OrderItems WHERE OrderId=@order; UPDATE ib SET ib.OnHand=ib.OnHand+oi.Quantity FROM InventoryBalances ib JOIN OrderItems oi ON oi.ProductId=ib.ProductId WHERE oi.OrderId=@order AND ib.OrganizationId=@org AND ib.LocationId=@location;", connection, transaction);
        reverse.Parameters.AddWithValue("org", actor.OrganizationId); reverse.Parameters.AddWithValue("location", actor.LocationId); reverse.Parameters.AddWithValue("order", orderId); reverse.Parameters.AddWithValue("user", actor.UserId); await reverse.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken); return await GetAsync(actor, orderId, cancellationToken);
    }

    public async Task<Guid> RefundAsync(ActorContext actor, Guid orderId, RefundOrderRequest input, CancellationToken cancellationToken)
    {
        if (input.Amount <= 0) throw new ArgumentException("Refund amount must be positive.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("INSERT INTO Refunds (Id,OrganizationId,PaymentId,OrderId,Amount,Reason,Status,CreatedBy) SELECT @id,p.Id,o.Id,o.Id,@amount,@reason,'REFUNDED',@user FROM Orders o JOIN Payments p ON p.OrderId=o.Id AND p.OrganizationId=o.OrganizationId WHERE o.Id=@order AND o.OrganizationId=@org AND o.LocationId=@location AND p.Status='PAID' AND @amount <= p.Amount;", connection);
        var refundId = Guid.NewGuid(); command.Parameters.AddWithValue("id", refundId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); command.Parameters.AddWithValue("order", orderId); command.Parameters.AddWithValue("amount", input.Amount); command.Parameters.AddWithValue("reason", input.Reason); command.Parameters.AddWithValue("user", actor.UserId);
        if (await command.ExecuteNonQueryAsync(cancellationToken) != 1) throw new InvalidOperationException("Order cannot be refunded.");
        return refundId;
    }
}
