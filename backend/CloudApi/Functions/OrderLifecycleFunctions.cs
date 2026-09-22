using System.Net;
using System.Text.Json;
using Counterpoint.CloudApi.Domain;
using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Functions;

public sealed class OrderLifecycleFunctions(TenantContext tenantContext, AuthorizationService authorization, OrderLifecycleService orders)
{
    [Function("GetOrder")]
    public Task<HttpResponseData> Get([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "orders/{id:guid}")] HttpRequestData request, Guid id, CancellationToken cancellationToken) => Execute(request, cancellationToken, "orders.read", actor => orders.GetAsync(actor, id, cancellationToken));

    [Function("UpdateOrderStatus")]
    public async Task<HttpResponseData> Status([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "orders/{id:guid}/status")] HttpRequestData request, Guid id, CancellationToken cancellationToken) => await Execute(request, cancellationToken, "orders.create", async actor => await orders.UpdateStatusAsync(actor, id, (await Body<UpdateOrderStatusRequest>(request, cancellationToken)).Status, cancellationToken));

    [Function("CancelOrder")]
    public async Task<HttpResponseData> Cancel([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "orders/{id:guid}/cancel")] HttpRequestData request, Guid id, CancellationToken cancellationToken) => await Execute(request, cancellationToken, "orders.cancel", actor => orders.CancelAsync(actor, id, cancellationToken));

    [Function("RefundOrder")]
    public async Task<HttpResponseData> Refund([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "orders/{id:guid}/refund")] HttpRequestData request, Guid id, CancellationToken cancellationToken) => await Execute(request, cancellationToken, "orders.refund", async actor => await orders.RefundAsync(actor, id, await Body<RefundOrderRequest>(request, cancellationToken), cancellationToken));

    private async Task<HttpResponseData> Execute<T>(HttpRequestData request, CancellationToken cancellationToken, string permission, Func<ActorContext, Task<T>> action)
    {
        try { var actor = tenantContext.Resolve(request); await authorization.RequirePermissionAsync(actor, permission, cancellationToken); var response = request.CreateResponse(HttpStatusCode.OK); await response.WriteAsJsonAsync(await action(actor), cancellationToken); return response; }
        catch (Exception exception) when (exception is UnauthorizedAccessException or ForbiddenException or ArgumentException or InvalidOperationException or KeyNotFoundException) { var code = exception is UnauthorizedAccessException ? HttpStatusCode.Unauthorized : exception is ForbiddenException ? HttpStatusCode.Forbidden : exception is KeyNotFoundException ? HttpStatusCode.NotFound : HttpStatusCode.BadRequest; var response = request.CreateResponse(code); await response.WriteAsJsonAsync(new { error = exception.Message }, cancellationToken); return response; }
    }

    private static async Task<T> Body<T>(HttpRequestData request, CancellationToken cancellationToken) => await JsonSerializer.DeserializeAsync<T>(request.Body, new JsonSerializerOptions(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true }, cancellationToken) ?? throw new ArgumentException("Invalid request body.");
}
