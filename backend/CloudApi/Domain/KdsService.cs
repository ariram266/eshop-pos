using Counterpoint.Contracts;
using Counterpoint.CloudApi.Infrastructure;
using Microsoft.Data.SqlClient;

namespace Counterpoint.CloudApi.Domain;

public sealed class KdsService(WebPubSubNotifier notifier)
{
	private readonly WebPubSubNotifier _notifier = notifier;
	public async Task CreateWorkItemsAsync(SqlConnection connection, SqlTransaction transaction, ActorContext actor, Guid orderId, string orderNumber, IReadOnlyList<OrderLineDto> lines, CancellationToken cancellationToken)
	{
		foreach (var line in lines.Where(line => !string.IsNullOrWhiteSpace(line.PreparationStationCode)))
		{
			await using var command = new SqlCommand("INSERT INTO KdsWorkItems (Id, OrganizationId, LocationId, OrderId, OrderNumber, ProductId, ProductName, Quantity, StationCode, Status, CreatedBy) VALUES (@id,@org,@location,@order,@number,@product,@name,@quantity,@station,'PENDING',@user);", connection, transaction);
			command.Parameters.AddWithValue("id", Guid.NewGuid());
			command.Parameters.AddWithValue("org", actor.OrganizationId);
			command.Parameters.AddWithValue("location", actor.LocationId);
			command.Parameters.AddWithValue("order", orderId);
			command.Parameters.AddWithValue("number", orderNumber);
			command.Parameters.AddWithValue("product", line.ProductId);
			command.Parameters.AddWithValue("name", line.Name);
			command.Parameters.AddWithValue("quantity", line.Quantity);
			command.Parameters.AddWithValue("station", line.PreparationStationCode!);
			command.Parameters.AddWithValue("user", actor.UserId);
			await command.ExecuteNonQueryAsync(cancellationToken);
		}
	}

	public async Task<IReadOnlyList<KdsWorkItemDto>> GetActiveAsync(SqlConnection connection, ActorContext actor, CancellationToken cancellationToken)
	{
		const string sql = "SELECT Id, OrderId, OrderNumber, ProductName, Quantity, StationCode, Status, CreatedAt FROM KdsWorkItems WHERE OrganizationId=@org AND LocationId=@location AND Status <> 'COMPLETED' ORDER BY CreatedAt;";
		await using var command = new SqlCommand(sql, connection);
		command.Parameters.AddWithValue("org", actor.OrganizationId);
		command.Parameters.AddWithValue("location", actor.LocationId);
		await using var reader = await command.ExecuteReaderAsync(cancellationToken);
		var items = new List<KdsWorkItemDto>();
		while (await reader.ReadAsync(cancellationToken))
			items.Add(new(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3), reader.GetDecimal(4), reader.GetString(5), reader.GetString(6), reader.GetDateTimeOffset(7)));
		return items;
	}

	public async Task<KdsWorkItemDto> UpdateStatusAsync(SqlConnection connection, ActorContext actor, Guid workItemId, string status, CancellationToken cancellationToken)
	{
		var normalized = status.Trim().ToUpperInvariant();
		var allowed = new[] { "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED" };
		if (!allowed.Contains(normalized, StringComparer.Ordinal)) throw new ArgumentException("Unsupported KDS status.");

		await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
		await using var current = new SqlCommand("SELECT Id,OrderId,OrderNumber,ProductName,Quantity,StationCode,Status,CreatedAt FROM KdsWorkItems WITH (UPDLOCK) WHERE Id=@id AND OrganizationId=@org AND LocationId=@location;", connection, transaction);
		current.Parameters.AddWithValue("id", workItemId); current.Parameters.AddWithValue("org", actor.OrganizationId); current.Parameters.AddWithValue("location", actor.LocationId);
		await using var reader = await current.ExecuteReaderAsync(cancellationToken);
		if (!await reader.ReadAsync(cancellationToken)) throw new KeyNotFoundException("KDS work item was not found.");
		var item = new KdsWorkItemDto(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3), reader.GetDecimal(4), reader.GetString(5), reader.GetString(6), reader.GetDateTimeOffset(7));
		await reader.CloseAsync();
		if (!IsValidTransition(item.Status, normalized)) throw new InvalidOperationException($"Cannot move KDS work from {item.Status} to {normalized}.");
		await using var update = new SqlCommand("UPDATE KdsWorkItems SET Status=@status,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id; INSERT INTO KdsWorkItemHistory (Id,OrganizationId,WorkItemId,Status,ChangedBy) VALUES (NEWID(),@org,@id,@status,@user);", connection, transaction);
		update.Parameters.AddWithValue("status", normalized); update.Parameters.AddWithValue("id", workItemId); update.Parameters.AddWithValue("org", actor.OrganizationId); update.Parameters.AddWithValue("user", actor.UserId); await update.ExecuteNonQueryAsync(cancellationToken);
		await transaction.CommitAsync(cancellationToken);
		await _notifier.PublishKdsAsync(actor.OrganizationId, actor.LocationId, workItemId, normalized, cancellationToken);
		return item with { Status = normalized };
	}

	private static bool IsValidTransition(string current, string next) => current.ToUpperInvariant() switch
	{
		"PENDING" or "QUEUED" => next is "ACCEPTED" or "CANCELLED",
		"ACCEPTED" => next is "PREPARING" or "CANCELLED",
		"PREPARING" => next is "READY" or "CANCELLED",
		"READY" => next is "COMPLETED",
		_ => false,
	};
}
