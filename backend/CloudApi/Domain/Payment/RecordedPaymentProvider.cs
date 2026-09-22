using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;

namespace Counterpoint.CloudApi.Domain.Payment;

public sealed class RecordedPaymentProvider : IPaymentProvider
{
    public async Task<PaymentResult> CaptureAsync(SqlConnection connection, SqlTransaction transaction, ActorContext actor, Guid orderId, decimal amount, string method, CancellationToken cancellationToken)
    {
        var paymentId = Guid.NewGuid();
        await using var command = new SqlCommand("INSERT INTO Payments (Id, OrganizationId, OrderId, Amount, Currency, Method, Provider, Status, CreatedBy) VALUES (@id,@org,@order,@amount,'USD',@method,'recorded','PAID',@user); INSERT INTO PaymentStateHistory (Id, OrganizationId, PaymentId, Status) VALUES (@history,@org,@id,'PAID');", connection, transaction);
        command.Parameters.AddWithValue("id", paymentId);
        command.Parameters.AddWithValue("org", actor.OrganizationId);
        command.Parameters.AddWithValue("order", orderId);
        command.Parameters.AddWithValue("amount", amount);
        command.Parameters.AddWithValue("method", method);
        command.Parameters.AddWithValue("user", actor.UserId);
        command.Parameters.AddWithValue("history", Guid.NewGuid());
        await command.ExecuteNonQueryAsync(cancellationToken);
        return new PaymentResult(paymentId, "PAID", "recorded");
    }
}
