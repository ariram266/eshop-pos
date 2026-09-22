using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;

namespace Counterpoint.CloudApi.Domain.Payment;

public interface IPaymentProvider
{
    Task<PaymentResult> CaptureAsync(SqlConnection connection, SqlTransaction transaction, ActorContext actor, Guid orderId, decimal amount, string method, CancellationToken cancellationToken);
}

public sealed record PaymentResult(Guid PaymentId, string Status, string Provider);
