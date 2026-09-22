using System.Net;
using Counterpoint.CloudApi.Domain;
using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Functions;

public sealed class KdsFunctions(TenantContext tenantContext, AuthorizationService authorization, SqlConnectionFactory connections, KdsService kds)
{
    [Function("ActiveKdsOrders")]
    public async Task<HttpResponseData> Active([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "kds/orders/active")] HttpRequestData request, CancellationToken cancellationToken)
    {
        try
        {
            var actor = tenantContext.Resolve(request);
            await authorization.RequirePermissionAsync(actor, "kds.execute", cancellationToken);
            await using var connection = connections.Create();
            await connection.OpenAsync(cancellationToken);
            var response = request.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(await kds.GetActiveAsync(connection, actor, cancellationToken), cancellationToken);
            return response;
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or ForbiddenException)
        {
            var response = request.CreateResponse(exception is ForbiddenException ? HttpStatusCode.Forbidden : HttpStatusCode.Unauthorized);
            await response.WriteAsJsonAsync(new { error = exception.Message }, cancellationToken);
            return response;
        }
    }

    [Function("UpdateKdsStatus")]
    public async Task<HttpResponseData> UpdateStatus([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "kds/orders/{id:guid}/status")] HttpRequestData request, Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var actor = tenantContext.Resolve(request);
            await authorization.RequirePermissionAsync(actor, "kds.execute", cancellationToken);
            var input = await System.Text.Json.JsonSerializer.DeserializeAsync<UpdateKdsStatusRequest>(request.Body, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true }, cancellationToken) ?? throw new ArgumentException("Invalid KDS status body.");
            await using var connection = connections.Create();
            await connection.OpenAsync(cancellationToken);
            var response = request.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(await kds.UpdateStatusAsync(connection, actor, id, input.Status, cancellationToken), cancellationToken);
            return response;
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or ForbiddenException or ArgumentException or InvalidOperationException or KeyNotFoundException)
        {
            var code = exception is UnauthorizedAccessException ? HttpStatusCode.Unauthorized : exception is ForbiddenException ? HttpStatusCode.Forbidden : exception is KeyNotFoundException ? HttpStatusCode.NotFound : HttpStatusCode.BadRequest;
            var response = request.CreateResponse(code);
            await response.WriteAsJsonAsync(new { error = exception.Message }, cancellationToken);
            return response;
        }
    }
}
