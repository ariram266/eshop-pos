using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Infrastructure;

public sealed class HealthFunctions(SqlConnectionFactory connections)
{
    [Function("Health")]
    public async Task<HttpResponseData> Health([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData request, CancellationToken cancellationToken)
    {
        var correlationId = Correlation.GetOrCreate(request);
        var response = request.CreateResponse(HttpStatusCode.OK);
        var database = "ok";
        try
        {
            await using var connection = connections.Create();
            await connection.OpenAsync(cancellationToken);
            await using var command = new Microsoft.Data.SqlClient.SqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync(cancellationToken);
        }
        catch
        {
            database = "unavailable";
            response = request.CreateResponse(HttpStatusCode.ServiceUnavailable);
        }
        Correlation.WithHeader(response, correlationId);
        await response.WriteAsJsonAsync(new { status = database == "ok" ? "ok" : "degraded", database, correlationId, utc = DateTimeOffset.UtcNow }, cancellationToken);
        return response;
    }
}
